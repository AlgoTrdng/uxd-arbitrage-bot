import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js'
// @ts-ignore
import { getAssociatedTokenAddress, NATIVE_MINT, closeAccount } from '@solana/spl-token'

import config from '../../app.config'
import { force } from '../utils/force'

let wrappedSolATAAddress: PublicKey | null = null

const getWrappedSolATAAddress = async () => {
  if (wrappedSolATAAddress) {
    return wrappedSolATAAddress
  }

  wrappedSolATAAddress = await getAssociatedTokenAddress(
    NATIVE_MINT,
    config.SOL_PUBLIC_KEY,
  ) as PublicKey

  return wrappedSolATAAddress
}

export const closeWrappedSolATA = async (connection: Connection) => {
  const wSolATAPublicKey = await getWrappedSolATAAddress()
  await force(
    () => (
      closeAccount(
        connection,
        config.SOL_PRIVATE_KEY,
        wSolATAPublicKey,
        config.SOL_PUBLIC_KEY,
        config.SOL_PRIVATE_KEY,
      ) as Promise<TransactionSignature>
    ),
    { wait: 200 },
  )
}
