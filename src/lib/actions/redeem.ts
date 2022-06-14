import {
  ConfirmedTransactionMeta,
  Connection,
  SendOptions,
  Transaction,
} from '@solana/web3.js'

import { mint } from '../../constants'
import { wait } from '../utils/wait'
import { getTs } from '../utils/getTimestamp'

const getTransactionData = (transactionMeta: ConfirmedTransactionMeta) => {
  const { postBalances, postTokenBalances } = transactionMeta
  const solChainBalance = postBalances[0]
  // postTokenBalances is always defined because if transaction fails `sendAndAwaitTransaction`
  // returns before calling `getTransactionData`
  // uxd balances is always defined because transaction swaps UXD for SOL
  const { uiTokenAmount } = postTokenBalances!
    .find(({ mint: mintAddress }) => mintAddress === mint.UXD.toString())!

  return {
    solChainBalance,
    uxdChainBalance: Number(uiTokenAmount.amount),
  }
}

const sendOptions: SendOptions = {
  maxRetries: 2,
  skipPreflight: true,
}
// MAX_RETRIES * RETRY_TIME + almost a minute for verifying if transaction went through
const MAX_REDEMPTION_TIME_MS = 100_000
const MAX_RETRIES = 20
const RETRY_TIME = 2_000

export const SendRedeemTxError = {
  BLOCK_HEIGHT_EXCEEDED: 'blockHeightExceeded',
  // Max redemption time is exceeded or transaction responds with error
  TIMEOUT_OR_ERROR: 'transactionTimedOutOrErrored',
} as const

const watchBlockHeight = async (
  connection: Connection,
  transaction: Transaction,
  startTime: number,
) => {
  const txValidUntilBlockHeight = transaction.lastValidBlockHeight!

  while (getTs() - startTime < MAX_REDEMPTION_TIME_MS) {
    const blockHeight = await connection.getBlockHeight(connection.commitment)

    if (blockHeight > txValidUntilBlockHeight) {
      return SendRedeemTxError.BLOCK_HEIGHT_EXCEEDED
    }

    await wait(2000)
  }

  return SendRedeemTxError.TIMEOUT_OR_ERROR
}

const forceTxRetriesAndConfirm = async (
  connection: Connection,
  serializedTransaction: Buffer,
  txId: string,
  startTime: number,
) => {
  let lastSendTransactionTs = startTime
  let retries = 0

  while (getTs() - startTime < MAX_REDEMPTION_TIME_MS) {
    if (retries < MAX_RETRIES && getTs() - lastSendTransactionTs < RETRY_TIME) {
      retries += 1
      lastSendTransactionTs = getTs()
      await connection.sendRawTransaction(serializedTransaction, sendOptions)
    }

    const response = await Promise.any([
      connection.getTransaction(txId, { commitment: 'confirmed' }),
      wait(5000),
    ])

    if (response) {
      if (!response.meta || response.meta.err) {
        console.log(response)
        return SendRedeemTxError.TIMEOUT_OR_ERROR
      }

      return response.meta
    }

    await wait(500)
  }

  return SendRedeemTxError.TIMEOUT_OR_ERROR
}

export type RedeemResponse =
  | typeof SendRedeemTxError[keyof typeof SendRedeemTxError]
  | ReturnType<typeof getTransactionData>

export const sendAndConfirmRedeem = async (connection: Connection, transaction: Transaction) => {
  const serializedTransaction = transaction.serialize()
  const txId = await connection.sendRawTransaction(serializedTransaction, sendOptions)
  const startTime = getTs()

  const response = await Promise.any([
    watchBlockHeight(connection, transaction, startTime),
    forceTxRetriesAndConfirm(connection, serializedTransaction, txId, startTime),
  ])

  if (typeof response !== 'string') {
    const postBalances = getTransactionData(response)
    return postBalances
  }

  return response
}
