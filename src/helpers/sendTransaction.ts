import { ConfirmedTransactionMeta, SendOptions, Transaction } from '@solana/web3.js'
import { setTimeout } from 'timers/promises'

import { connection } from '../config'
import { UXD_MINT } from '../constants'

const MAX_CONFIRMATION_TIME = 120_000

const parseTransactionMeta = (transactionMeta: ConfirmedTransactionMeta) => {
  const {
    postBalances,
    preBalances,
    preTokenBalances,
    postTokenBalances,
  } = transactionMeta
  const solRawAmount = postBalances[0]

  // -----------------
  // GET POST BALANCES
  // postTokenBalances is always defined because if transaction fails `sendAndAwaitTransaction`
  // returns before calling `getTransactionData`
  // uxd balances is always defined because transaction swaps UXD for SOL
  const postUxdBalance = postTokenBalances!
    .find(({ mint: mintAddress }) => mintAddress === UXD_MINT.toString())!

  // ---------------------
  // GET TOKEN DIFFERENCES
  const preUxdBalance = preTokenBalances!
    .find(({ mint: mintAddress }) => mintAddress === UXD_MINT.toString())!
  const uxdRawDifference = Math.abs(
    Number(preUxdBalance.uiTokenAmount.amount) - Number(postUxdBalance.uiTokenAmount.amount),
  )
  const solRawDifference = Math.abs(preBalances[0] - postBalances[0])

  return {
    solRawAmount,
    solRawDifference,
    uxdRawDifference,
    uxdRawAmount: Number(postUxdBalance.uiTokenAmount.amount),
  }
}

export const TransactionResponse = {
  BLOCK_HEIGHT_EXCEEDED: 'blockHeightExceeded',
  ERROR: 'transactionError',
  // Max redemption time is exceeded
  TIMEOUT: 'transactionTimedOut',
} as const

const watchTxConfirmation = async (
  startTime: number,
  txId: string,
) => {
  while (new Date().getTime() - startTime < MAX_CONFIRMATION_TIME) {
    const response = await Promise.any([
      connection.getTransaction(txId, { commitment: 'confirmed' }),
      setTimeout(5000),
    ])
    if (response?.meta) {
      if (response.meta.err) {
        return TransactionResponse.ERROR
      }

      return response.meta
    }

    await setTimeout(500)
  }

  return TransactionResponse.TIMEOUT
}

const watchBlockHeight = async (
  startTime: number,
  transaction: Transaction,
  abortSignal: AbortSignal,
) => {
  const txValidUntilBlockHeight = transaction.lastValidBlockHeight!

  while (new Date().getTime() - startTime < MAX_CONFIRMATION_TIME && !abortSignal.aborted) {
    let blockHeight = -1
    try {
      blockHeight = await connection.getBlockHeight(connection.commitment)
    // eslint-disable-next-line no-empty
    } catch (error) {}

    if (blockHeight > txValidUntilBlockHeight) {
      return TransactionResponse.BLOCK_HEIGHT_EXCEEDED
    }

    await setTimeout(2000)
  }

  return TransactionResponse.TIMEOUT
}

export type SuccessResponse = {
  success: true
  data: ReturnType<typeof parseTransactionMeta>
}

export type ErrorResponse = {
  success: false,
  err: null | typeof TransactionResponse.BLOCK_HEIGHT_EXCEEDED
}

export const sendAndConfirmTransaction = async (
  transaction: Transaction,
): Promise<SuccessResponse | ErrorResponse> => {
  const sendOptions: SendOptions = {
    maxRetries: 20,
    skipPreflight: true,
  }

  const rawTx = transaction.serialize()
  const txId = await connection.sendRawTransaction(rawTx, sendOptions)
  const startTime = new Date().getTime()

  const abortController = new AbortController()
  const response = await Promise.any([
    watchTxConfirmation(startTime, txId),
    watchBlockHeight(startTime, transaction, abortController.signal),
  ])
  abortController.abort()

  if (response === TransactionResponse.BLOCK_HEIGHT_EXCEEDED) {
    return {
      success: false,
      err: TransactionResponse.BLOCK_HEIGHT_EXCEEDED,
    }
  }
  if (typeof response === 'string') {
    return {
      success: false,
      err: null,
    }
  }

  return {
    success: true,
    data: parseTransactionMeta(response),
  }
}
