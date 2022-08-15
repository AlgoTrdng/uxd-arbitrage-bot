import {
  ConfirmedTransactionMeta,
  SendOptions,
  TokenBalance,
  Transaction,
} from '@solana/web3.js'
import { setTimeout } from 'timers/promises'

import { connection, walletKeypair } from '../config'
import { UXD_MINT } from '../constants'

const MAX_CONFIRMATION_TIME = 120_000

const findTokenAmountInfo = (
  tokenAmountInfos: TokenBalance[],
) => (
  tokenAmountInfos.find(({ owner, mint }) => (
    owner === walletKeypair.publicKey.toString() && mint === UXD_MINT.toString()
  ))!
)

export type ParsedTransactionMeta = {
  postUxdAmountRaw: number
  uxdSwapAmountRaw: number
  solSwapAmountRaw: number
}

export const parseTransactionMeta = (meta: ConfirmedTransactionMeta): ParsedTransactionMeta => {
  const {
    preTokenBalances,
    postTokenBalances,
    preBalances,
    postBalances,
  } = meta

  const { uiTokenAmount: preUxdAmountInfo } = findTokenAmountInfo(preTokenBalances!)
  const { uiTokenAmount: postUxdAmountInfo } = findTokenAmountInfo(
    postTokenBalances!,
  )

  const preUxdAmountRaw = Number(preUxdAmountInfo.amount)
  const postUxdAmountRaw = Number(postUxdAmountInfo.amount)

  const uxdSwapAmountRaw = Math.abs(preUxdAmountRaw - postUxdAmountRaw)
  const solSwapAmountRaw = Math.abs(preBalances[0] - postBalances[0]) - 5000 // Tx fee

  return {
    postUxdAmountRaw,
    uxdSwapAmountRaw,
    solSwapAmountRaw,
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
  data: ConfirmedTransactionMeta
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

  const blockHeightErr = TransactionResponse.BLOCK_HEIGHT_EXCEEDED
  if (typeof response === 'string') {
    return {
      success: false,
      err: response === blockHeightErr ? blockHeightErr : null,
    }
  }

  return {
    success: true,
    data: response,
  }
}
