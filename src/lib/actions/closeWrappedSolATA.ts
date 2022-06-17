import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js'
// @ts-ignore
import { getAssociatedTokenAddress, NATIVE_MINT, closeAccount } from '@solana/spl-token'

import config from '../../app.config'
import { force } from '../utils/force'

export class CloseWrappedSolATA {
  private static wSolATAPublicKey: PublicKey | null = null

  private static async getWrappedSolATAPublicKey() {
    if (CloseWrappedSolATA.wSolATAPublicKey) {
      return CloseWrappedSolATA.wSolATAPublicKey
    }

    const wrappedSoLPublicKey = await getAssociatedTokenAddress(
      NATIVE_MINT,
      config.SOL_PUBLIC_KEY,
    ) as PublicKey
    CloseWrappedSolATA.wSolATAPublicKey = wrappedSoLPublicKey
    return CloseWrappedSolATA.wSolATAPublicKey
  }

  static async execute(connection: Connection) {
    const wSolATAPublicKey = await CloseWrappedSolATA.getWrappedSolATAPublicKey()
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
}
