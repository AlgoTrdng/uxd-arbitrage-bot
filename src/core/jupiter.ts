import { Jupiter } from '@jup-ag/core'
import { PublicKey, Transaction } from '@solana/web3.js'
import JSBI from 'jsbi'
import { setTimeout } from 'timers/promises'

import { connection, walletKeypair } from '../config'
import { SOL_MINT, UXD_MINT } from '../constants'
import {
  findUxdAmountInfo,
  ParsedTransactionMeta,
  parseTransactionMeta,
  sendAndConfirmTransaction,
  TransactionResponse,
} from '../helpers/transaction'

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

type ExecuteJupiterSwapParams = {
  jupiter: Jupiter
  amountRaw: number
  direction: Direction
}

export const signJupiterTransactions = (transactions: Record<string, null | Transaction>) => {
  Object.values(transactions).forEach((tx) => {
    if (tx) {
      tx.sign(walletKeypair)
    }
  })
}

type AbortFn = () => Promise<boolean>

/* eslint-disable no-redeclare, no-unused-vars */
export function executeJupiterSwap(
  { jupiter, direction, amountRaw }: ExecuteJupiterSwapParams,
): Promise<ParsedTransactionMeta>
export function executeJupiterSwap(
  { jupiter, direction, amountRaw }: ExecuteJupiterSwapParams,
  shouldAbort?: AbortFn,
): Promise<ParsedTransactionMeta | null>
export async function executeJupiterSwap(
  { jupiter, direction, amountRaw }: ExecuteJupiterSwapParams,
  shouldAbort?: AbortFn,
) {
  // Get txs
  const bestRoute = await fetchBestJupiterRoute({
    jupiter,
    amountRaw,
    direction,
    forceFetch: true,
  })
  const { transactions } = await jupiter.exchange({ routeInfo: bestRoute })

  signJupiterTransactions(transactions)

  // Execute
  const forceTx = async (tx: Transaction) => {
    while (true) {
      const res = await sendAndConfirmTransaction(tx)
      if (res.success) {
        return res.data
      }
      await setTimeout(500)
      if (res.err === TransactionResponse.BLOCK_HEIGHT_EXCEEDED) {
        if (shouldAbort && await shouldAbort()) {
          return () => null
        }
        return () => (
          executeJupiterSwap({
            jupiter,
            direction,
            amountRaw,
          }, shouldAbort)
        )
      }
    }
  }

  const {
    setupTransaction: setupTx,
    swapTransaction: swapTx,
    cleanupTransaction: cleanupTx,
  } = transactions

  let setupATARent = 0
  if (setupTx) {
    const setupRes = await forceTx(setupTx)
    if (typeof setupRes === 'function') {
      return setupRes()
    }
    setupATARent = Math.abs(
      setupRes.postBalances[0] - setupRes.preBalances[0],
    )
  }

  const swapRes = await forceTx(swapTx)
  if (typeof swapRes === 'function') {
    return swapRes()
  }
  const swapMeta = parseTransactionMeta(swapRes)

  if (cleanupTx) {
    const cleanupRes = await forceTx(cleanupTx)
    if (typeof cleanupRes === 'function') {
      return cleanupRes()
    }

    (() => {
      if (cleanupRes.postTokenBalances?.length) {
        const postUxdBalanceInfo = findUxdAmountInfo(cleanupRes.postTokenBalances)
        if (postUxdBalanceInfo) {
          swapMeta.postUxdAmountRaw = Number(postUxdBalanceInfo.uiTokenAmount.amount)
          return
        }
      }

      const solSwapAmountRaw = Math.abs(
        cleanupRes.postBalances[0] - cleanupRes.preBalances[0],
      )
      // 5000 * 3 -> setup, cleanup and swap
      swapMeta.solSwapAmountRaw = solSwapAmountRaw - setupATARent - 15000
    })()
  }

  return swapMeta
}
/* eslint-enable no-redeclare, no-unused-vars */
