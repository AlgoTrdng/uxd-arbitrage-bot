import {
  ConfirmedTransactionMeta,
  Connection,
  SendOptions,
  Transaction,
} from '@solana/web3.js'
import config from '../../app.config'
import { mint } from '../../constants'

import { UxdWrapper } from '../../wrappers/uxd'
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
const MAX_RETRIES = 20
const RETRY_TIME = 5_000

const sendAndAwaitTransaction = async (connection: Connection, transaction: Transaction) => {
  const serializedTransaction = transaction.serialize()
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

export const redeem = async (connection: Connection, uxdUiBalance: number, uxdWrapper: UxdWrapper) => {
  const tx = await uxdWrapper.createRedeemTransaction(uxdUiBalance)
  tx.sign(config.SOL_PRIVATE_KEY)
  const success = await sendAndAwaitTransaction(connection, tx)
  return success
}
