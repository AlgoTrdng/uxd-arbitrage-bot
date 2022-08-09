import { Jupiter } from '@jup-ag/core'
import { TextChannel } from 'discord.js'
import JSBI from 'jsbi'

import { config } from '../config'
import { Decimals, USDC_MINT, UXD_MINT } from '../constants'
import { round, toRaw, toUi } from '../helpers/amount'
import { sendReBalanceMessage } from '../logging/discord'

type CheckAndExecuteReBalanceParams = {
  uxdBalanceUi: number
  discordChannel: TextChannel
  jupiter: Jupiter
}

export const checkAndExecuteReBalance = async ({
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
