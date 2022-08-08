import { Jupiter } from '@jup-ag/core'
import JSBI from 'jsbi'

import { config } from '../config'
import { Decimals, USDC_MINT, UXD_MINT } from '../constants'
import { toRaw } from '../helpers/amount'

export const checkAndExecuteReBalance = async (
  uxdBalanceUi: number,
  jupiter: Jupiter,
) => {
  console.log(`Checking for re-balance; balance: ${uxdBalanceUi} UXD, threshold: ${config.maxUxdAmountUi + 1} UXD`)
  if (uxdBalanceUi <= config.maxUxdAmountUi + 1) {
    return
  }

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

  console.log(`Successfully re-balanced ${swapAmountUi} UXD to USDC`)
}
