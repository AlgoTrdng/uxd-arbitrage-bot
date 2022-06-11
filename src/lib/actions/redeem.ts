import { ConfirmedTransactionMeta, Connection, SendOptions } from '@solana/web3.js'
import { mint } from '../../constants'

import { wait } from '../utils/wait'

const getTs = () => new Date().getTime()

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

const MAX_WAIT_TIME = 60_000 // MAX_RETRIES * RETRY_TIME + some room for verifying transaction
const MAX_RETRIES = 10
const RETRY_TIME = 3_000

export const sendAndAwaitRawRedeemTransaction = async (connection: Connection, serializedTransaction: Buffer) => {
  const txid = await connection.sendRawTransaction(serializedTransaction, sendOptions)
  const sendTransactionTs = getTs()

  let retries = 0
  let lastSendTransactionTs = sendTransactionTs

  while (getTs() - sendTransactionTs < MAX_WAIT_TIME) {
    if (retries < MAX_RETRIES && getTs() - lastSendTransactionTs < RETRY_TIME) {
      retries += 1
      lastSendTransactionTs = getTs()
      await connection.sendRawTransaction(serializedTransaction, sendOptions)
    }

    const response = await Promise.any([
      connection.getTransaction(txid, { commitment: 'confirmed' }),
      wait(5000),
    ])

    if (response) {
      if (!response.meta || response.meta.err) {
        return null
      }

      const postBalances = getTransactionData(response.meta)
      return postBalances
    }

    await wait(500)
  }

  return null
}
