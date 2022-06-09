import { SOL_DECIMALS } from '@uxd-protocol/uxd-client'
import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js'
// @ts-ignore
import { getAssociatedTokenAddress, NATIVE_MINT, closeAccount } from '@solana/spl-token'

import { JupiterWrapper } from '../../wrappers/jupiter'
import { mint } from '../../constants'
import { getChainAmount } from '../utils/amount'
import config from '../../app.config'

export const swapSolToUxd = async (jupiterWrapper: JupiterWrapper, solUiBalance: number) => {
  const safeSolAmount = getChainAmount(solUiBalance, SOL_DECIMALS) - 100_000_000 // 0.1 SOL

  const routeInfo = await jupiterWrapper.fetchBestRouteInfo(
    mint.SOL,
    mint.UXD,
    safeSolAmount,
  )
  const swapResult = await jupiterWrapper.swap(routeInfo)
  return swapResult
}

let wSolATAPublicKey: PublicKey | null = null

const getWSolATAPublicKey = async () => {
  if (wSolATAPublicKey) {
    return wSolATAPublicKey
  }

  const wrappedSoLPublicKey = await getAssociatedTokenAddress(
    NATIVE_MINT,
    config.SOL_PUBLIC_KEY,
  ) as PublicKey
  wSolATAPublicKey = wrappedSoLPublicKey
  return wSolATAPublicKey
}

export const swapWSolToSol = async (connection: Connection) => {
  const wSolATA = await getWSolATAPublicKey()
  try {
    return closeAccount(
      connection,
      config.SOL_PRIVATE_KEY,
      wSolATA,
      config.SOL_PUBLIC_KEY,
      config.SOL_PRIVATE_KEY,
    ) as Promise<TransactionSignature>
  } catch (error) {
    console.log(error)
    return null
  }
}
