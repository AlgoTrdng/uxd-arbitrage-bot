import { Jupiter } from '@jup-ag/core'
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

type CheckAndExecuteReBalanceParams = {
  uxdBalanceUi: number
  discordChannel: TextChannel
  jupiter: Jupiter
}

export const checkAndExecuteUxdReBalance = async ({
  uxdBalanceUi,
  discordChannel,
  jupiter,
}: CheckAndExecuteReBalanceParams) => {
  if (uxdBalanceUi <= config.maxUxdAmountUi + 1) {
    return
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
    return
  }

  const [bestRoute] = routesInfos
  // No need to confirm, just retry after next arb
  const { execute } = await jupiter.exchange({ routeInfo: bestRoute })
  const swapResult = await execute()
  if (!('txid' in swapResult)) {
    return
  }

  const swapInputAmountUi = toUi(swapResult.inputAmount, Decimals.USD)
  await sendReBalanceMessage({
    channel: discordChannel,
    oldAmount: round(uxdBalanceUi, 2),
    newAmount: round(uxdBalanceUi - swapInputAmountUi, 2),
  })
  console.log(`Successfully re-balanced ${swapAmountUi} UXD to USDC`)
}

export const checkAndExecuteSolReBalance = async (jupiter: Jupiter) => {
  const solBalance = await getSolBalanceRaw()

  if (solBalance > config.minSolAmountRaw - 30_000_000) {
    return
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
    return
  }

  const uxdAmountUi = solSwapAmountUi * price
  const { routesInfos } = await jupiter.computeRoutes({
    inputMint: UXD_MINT,
    outputMint: SOL_MINT,
    amount: JSBI.BigInt(toRaw(uxdAmountUi, Decimals.USD)),
    slippage: 0.5,
  })
  if (!routesInfos.length) {
    return
  }
  const [bestRoute] = routesInfos
  const { execute } = await jupiter.exchange({ routeInfo: bestRoute })
  await execute()
  console.log('Successfully executed SOL re-balance.')
}
