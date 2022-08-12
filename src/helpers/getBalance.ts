import { getAssociatedTokenAddress } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'

import { walletKeypair, connection } from '../config'
import { UXD_MINT } from '../constants'
import { forceOnError } from './forceOnError'

let uxdATA: null | PublicKey = null

export const getUxdBalanceRaw = async () => {
  if (!uxdATA) {
    uxdATA = await getAssociatedTokenAddress(
      UXD_MINT,
      walletKeypair.publicKey,
    )
  }
  if (!uxdATA) {
    throw Error('Could not get UXD ATA')
  }

  const res = await forceOnError(
    () => connection.getTokenAccountBalance(uxdATA!),
  )
  return Number(res.value.amount)
}

export const getSolBalanceRaw = async () => (
  forceOnError(
    () => connection.getBalance(walletKeypair.publicKey),
    500,
  )
)
