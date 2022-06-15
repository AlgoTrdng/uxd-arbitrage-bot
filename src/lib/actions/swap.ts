import { SOL_DECIMALS } from '@uxd-protocol/uxd-client'
import { Connection, PublicKey, TransactionSignature } from '@solana/web3.js'
// @ts-ignore
import { getAssociatedTokenAddress, NATIVE_MINT, closeAccount } from '@solana/spl-token'

import { JupiterWrapper } from '../wrappers'
import { MINIMUM_SOL_CHAIN_AMOUNT, mint } from '../../constants'
import { getChainAmount } from '../utils/amount'
import config from '../../app.config'

type SwapResultSuccess = {
  txid: string
  inputAmount: number
  outputAmount: number
}

export const swapSolToUxd = async (jupiterWrapper: JupiterWrapper, solUiBalance: number) => {
  const safeSolAmount = getChainAmount(solUiBalance, SOL_DECIMALS) - MINIMUM_SOL_CHAIN_AMOUNT

  const routeInfo = await jupiterWrapper.fetchBestRouteInfo(
    mint.SOL,
    mint.UXD,
    safeSolAmount,
  )
  const swapResult = await jupiterWrapper.swap(routeInfo)
  return swapResult as SwapResultSuccess | null
}

// TODO: probably won't be needed
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
  let signature: string | null = null

  try {
    signature = await (closeAccount(
      connection,
      config.SOL_PRIVATE_KEY,
      wSolATA,
      config.SOL_PUBLIC_KEY,
      config.SOL_PRIVATE_KEY,
    ) as Promise<TransactionSignature>)
  } catch (error) {
    console.log(error)
  }

  return signature
}
