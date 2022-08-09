import { Jupiter, SwapMode } from '@jup-ag/core'
import { PublicKey } from '@solana/web3.js'
import JSBI from 'jsbi'

import { connection, walletKeypair } from '../config'
import { SOL_MINT, UXD_MINT } from '../constants'

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

const mints = [
  SOL_MINT,
  UXD_MINT,
]

export const Directions = {
  REDEMPTION: 'redemption',
  MINT: 'mint',
} as const
export type Direction = typeof Directions[keyof typeof Directions]

export type FetchBestRouteParams = {
  jupiter: Jupiter
  amountRaw: number
  direction: Direction
  forceFetch?: boolean
}

export const fetchBestJupiterRoute = async ({
  jupiter,
  amountRaw,
  forceFetch,
  direction,
}: FetchBestRouteParams) => {
  /*
    Directions
    - MINT -> SWAP UXD to SOL
    - REDEEM -> SWAP SOL to UXD
  */
  const [inputMint, outputMint] = direction === Directions.MINT ? [mints[1], mints[0]] : mints
  const result = await jupiter.computeRoutes({
    inputMint,
    outputMint,
    forceFetch,
    amount: JSBI.BigInt(amountRaw),
    slippage: 0.5,
  })
  return result.routesInfos[0]
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
  direction,
  amountRaw,
}: Omit<FetchBestRouteParams, 'forceFetch'>) => {
  const bestRoute = await fetchBestJupiterRoute({
    jupiter,
    amountRaw,
    direction,
    forceFetch: true,
  })
  const { execute } = await jupiter.exchange({ routeInfo: bestRoute })
  const swapResult = await execute()

  if ('txid' in swapResult) {
    return swapResult as SwapResult
  }

  return null
}
