import { Jupiter, SwapMode } from '@jup-ag/core'
import { PublicKey } from '@solana/web3.js'
import JSBI from 'jsbi'

import { connection, walletKeypair } from '../config'

export const initJupiter = async () => (
  Jupiter.load({
    connection,
    cluster: 'mainnet-beta',
    user: walletKeypair,
    routeCacheDuration: 15_000,
  })
)

export type RouteParams = {
  inputMint: PublicKey
  outputMint: PublicKey
  amountRaw: number
  exactOut?: true
}

type FetchBestJupiterRouteParams = {
  jupiter: Jupiter
} & RouteParams

export const fetchBestJupiterRoute = async ({
  jupiter,
  amountRaw,
  exactOut,
  ...routeParams
}: FetchBestJupiterRouteParams) => {
  const swapMode = exactOut ? SwapMode.ExactOut : SwapMode.ExactIn
  const { routesInfos } = await jupiter.computeRoutes({
    ...routeParams,
    swapMode,
    amount: JSBI.BigInt(amountRaw),
    slippage: 0.25,
  })
  return routesInfos[0]
}

export type SwapResult = {
  txid: string
  inputAddress: PublicKey
  outputAddress: PublicKey
  inputAmount: number
  outputAmount: number
}

export const fetchBestRouteAndExecuteSwap = async ({
  jupiter,
  ...routeParams
}: FetchBestJupiterRouteParams) => {
  const bestRoute = await fetchBestJupiterRoute({ jupiter, ...routeParams })
  const { execute } = await jupiter.exchange({ routeInfo: bestRoute })
  const swapResult = await execute()

  if ('txid' in swapResult) {
    return swapResult as SwapResult
  }

  return null
}
