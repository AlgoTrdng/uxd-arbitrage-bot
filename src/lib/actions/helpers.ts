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

// MAX_RETRIES * RETRY_TIME (on RPC node should be 2 seconds) = 40
// + minute than 60 seconds for verifying if transaction went through
const MAX_REDEMPTION_TIME_MS = 120_000
const MAX_RETRIES = 20

const sendOptions: SendOptions = {
  maxRetries: MAX_RETRIES,
  skipPreflight: true,
}

export const SendRedeemTxError = {
  BLOCK_HEIGHT_EXCEEDED: 'blockHeightExceeded',
  ERROR: 'transactionError',
  // Max redemption time is exceeded
  TIMEOUT: 'transactionTimedOut',
} as const

const watchBlockHeight = async (
  connection: Connection,
  transaction: Transaction,
  startTime: number,
) => {
  const txValidUntilBlockHeight = transaction.lastValidBlockHeight!

  while (getTs() - startTime < MAX_REDEMPTION_TIME_MS) {
    let blockHeight = -1

    try {
      blockHeight = await connection.getBlockHeight(connection.commitment)
    // eslint-disable-next-line no-empty
    } catch (error) {}

    if (blockHeight > txValidUntilBlockHeight) {
      return SendRedeemTxError.BLOCK_HEIGHT_EXCEEDED
    }

    await wait(2000)
  }

  return SendRedeemTxError.TIMEOUT
}

const watchTxConfirmation = async (
  connection: Connection,
  txId: string,
  startTime: number,
) => {
  while (getTs() - startTime < MAX_REDEMPTION_TIME_MS) {
    const response = await Promise.any([
      connection.getTransaction(txId, { commitment: 'confirmed' }),
      wait(5000),
    ])

    if (response?.meta) {
      if (response.meta.err) {
        // Insufficient balance SOL balance for TX, previous TX was went through, should never happen
        // if happens, make MAX_REDEMPTION_TIME bigger
        if (response.meta.logMessages?.some((message) => message.includes('Custom program error: 0x8'))) {
          console.log('Previous TX was successful')
          return response.meta
        }

        return SendRedeemTxError.ERROR
      }

      return response.meta
    }

    await wait(500)
  }

  return SendRedeemTxError.TIMEOUT
}

type TxConfirmationResponse =
  | typeof SendRedeemTxError[keyof typeof SendRedeemTxError]
  | ConfirmedTransactionMeta

export type SuccessResponse = ReturnType<typeof getTransactionData>

export type SendTxResponse = SuccessResponse | null

export const sendAndConfirmTransaction = async (
  connection: Connection,
  transaction: Transaction,
): Promise<SendTxResponse> => {
  const serializedTransaction = transaction.serialize()
  const txId = await connection.sendRawTransaction(serializedTransaction, sendOptions)
  const startTime = getTs()

  const response: TxConfirmationResponse = await Promise.any([
    watchBlockHeight(connection, transaction, startTime),
    watchTxConfirmation(connection, txId, startTime),
  ])

  if (typeof response !== 'string') {
    const postBalances = getTransactionData(response)
    return postBalances
  }

  return null
}
