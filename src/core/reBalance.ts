import { Jupiter, RouteInfo } from '@jup-ag/core'
import { TextChannel } from 'discord.js'
import JSBI from 'jsbi'

import { config } from '../config'
import {
  Decimals,
  SOL_MINT,
  USDC_MINT,
  UXD_MINT,
} from '../constants'
import { round, toRaw, toUi } from '../helpers/amount'
import { sendReBalanceMessage } from '../logging/discord'
import { getSolBalanceRaw } from '../helpers/getBalance'
import { signJupiterTransactions } from './jupiter'
import {
  parseTransactionMeta,
  sendAndConfirmTransaction,
  TransactionResponse,
} from '../helpers/transaction'

const tryExecuteJupiterSwap = async (jupiter: Jupiter, bestRoute: RouteInfo) => {
  const { transactions } = await jupiter.exchange({ routeInfo: bestRoute })
  signJupiterTransactions(transactions)

  if (transactions.setupTransaction) {
    await sendAndConfirmTransaction(transactions.setupTransaction)
  }

  while (true) {
    const res = await sendAndConfirmTransaction(transactions.swapTransaction)
    if (res.success) {
      return parseTransactionMeta(res.data)
    }
    if (res.err === TransactionResponse.BLOCK_HEIGHT_EXCEEDED) {
      break
    }
  }

  if (transactions.cleanupTransaction) {
    await sendAndConfirmTransaction(transactions.cleanupTransaction)
  }

  return null
}

const findBestNonSerumRoute = (routesInfos: RouteInfo[]) => {
  for (let i = 0; i < routesInfos.length; i += 1) {
    if (routesInfos[i].marketInfos[0].amm.label !== 'Serum') {
      return routesInfos[i]
    }
  }
  return null
}

type UxdReBalanceParams = {
  uxdBalanceUi: number
  discordChannel: TextChannel
  jupiter: Jupiter
}

export const tryExecuteUxdReBalance = async ({
  uxdBalanceUi,
  discordChannel,
  jupiter,
}: UxdReBalanceParams) => {
  if (uxdBalanceUi <= config.maxUxdAmountUi + 1) {
    return null
  }
  console.log(`Executing re-balance. Balance: ${uxdBalanceUi} UXD, Threshold: ${config.maxUxdAmountUi + 1} UXD`)

  const swapAmountUi = uxdBalanceUi - config.minUxdAmountUi - 1

  const { routesInfos } = await jupiter.computeRoutes({
    inputMint: UXD_MINT,
    outputMint: USDC_MINT,
    amount: JSBI.BigInt(toRaw(swapAmountUi, Decimals.USD)),
    slippage: 0.5,
  })
  if (!routesInfos.length) {
    return null
  }
  const bestRoute = findBestNonSerumRoute(routesInfos)
  if (!bestRoute) {
    return null
  }

  const swapResult = await tryExecuteJupiterSwap(jupiter, bestRoute)

  if (swapResult) {
    const postSwapUxdAmountUi = toUi(swapResult.postUxdAmountRaw, Decimals.USD)
    await sendReBalanceMessage({
      channel: discordChannel,
      oldAmount: uxdBalanceUi,
      newAmount: postSwapUxdAmountUi,
    })
    console.log(`Successfully re-balanced ${swapAmountUi} UXD to USDC`)
  }

  return swapResult?.postUxdAmountRaw || null
}

export const tryExecuteSolReBalance = async (jupiter: Jupiter) => {
  const solBalance = await getSolBalanceRaw()

  if (solBalance > config.minSolAmountRaw - 30_000_000) {
    return null
  }
  const solSwapAmountUi = toUi(config.minSolAmountRaw - solBalance, Decimals.SOL)
  console.log(`Executing SOL re-balance. Amount: ${solSwapAmountUi} SOL`)

  const price = await (async () => {
    const { routesInfos: infoRoutesInfos } = await jupiter.computeRoutes({
      inputMint: UXD_MINT,
      outputMint: SOL_MINT,
      amount: JSBI.BigInt(1_000_000),
      slippage: 0.5,
    })
    if (!infoRoutesInfos.length) {
      return null
    }

    const [bestInfoRoute] = infoRoutesInfos
    const input = toUi(Number(bestInfoRoute.inAmount.toString()), Decimals.USD)
    const output = toUi(Number(bestInfoRoute.outAmount.toString()), Decimals.SOL)
    return round(input / output, 2)
  })()

  if (!price) {
    return null
  }

  const uxdAmountUi = solSwapAmountUi * price
  const { routesInfos } = await jupiter.computeRoutes({
    inputMint: UXD_MINT,
    outputMint: SOL_MINT,
    amount: JSBI.BigInt(toRaw(uxdAmountUi, Decimals.USD)),
    slippage: 0.5,
  })
  if (!routesInfos.length) {
    return null
  }
  const bestRoute = findBestNonSerumRoute(routesInfos)
  if (!bestRoute) {
    return null
  }

  const swapResult = await tryExecuteJupiterSwap(jupiter, bestRoute)
  if (swapResult) {
    console.log('Successfully executed SOL re-balance.')
  }
  return swapResult?.postUxdAmountRaw || null
}

export const tryReBalance = async ({
  jupiter,
  discordChannel,
  uxdBalanceUi,
}: UxdReBalanceParams) => {
  const postUxdReBalanceAmountRaw = await tryExecuteUxdReBalance({
    uxdBalanceUi,
    jupiter,
    discordChannel,
  })
  const postSolReBalanceAmountRaw = await tryExecuteSolReBalance(jupiter)
  if (postSolReBalanceAmountRaw) {
    return postSolReBalanceAmountRaw
  }
  return postUxdReBalanceAmountRaw || null
}
