import { Jupiter } from '@jup-ag/core'
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

export type JupiterActionParams = {
  jupiter: Jupiter
  amountRaw: number
  direction: Direction
  forceFetch?: true
}

export const fetchBestJupiterRoute = async ({
  jupiter,
  amountRaw,
  direction,
  forceFetch,
}: JupiterActionParams) => {
  /*
    Directions
    - MINT -> SWAP UXD to SOL
    - REDEEM -> SWAP SOL to UXD
  */
  const [inputMint, outputMint] = direction === Directions.MINT ? [mints[1], mints[0]] : mints
  const { routesInfos } = await jupiter.computeRoutes({
    inputMint,
    outputMint,
    forceFetch,
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
}: JupiterActionParams) => {
  const bestRoute = await fetchBestJupiterRoute({ jupiter, ...routeParams })
  const { execute } = await jupiter.exchange({ routeInfo: bestRoute })
  const swapResult = await execute()

  if ('txid' in swapResult) {
    return swapResult as SwapResult
  }

  return null
}
