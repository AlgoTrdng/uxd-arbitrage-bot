import { Connection, sendAndConfirmTransaction } from '@solana/web3.js'

import config from '../../app.config'
import { UxdWrapper } from '../../wrappers/uxd'

export const redeem = async (connection: Connection, uxdUiBalance: number, uxdWrapper: UxdWrapper) => {
  const tx = uxdWrapper.createRedeemTransaction(uxdUiBalance)
  let signature: string | null = null

  try {
    signature = await sendAndConfirmTransaction(connection, tx, [config.SOL_PRIVATE_KEY])
  } catch (error) {
    console.log(error)
  }

  return signature
}