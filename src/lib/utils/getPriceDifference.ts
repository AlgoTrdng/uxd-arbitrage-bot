import { UXD_DECIMALS, SOL_DECIMALS } from '@uxd-protocol/uxd-client'
import { mint } from '../../constants'

import { getUiAmount } from './amount'
import { MangoWrapper, JupiterWrapper } from '../wrappers'

const getSolVsUxdJupiterPrice = async (jupiterWrapper: JupiterWrapper, solUiAmount: number) => {
  try {
    const bestRouteInfo = await jupiterWrapper.fetchBestRouteInfo(mint.SOL, mint.UXD, solUiAmount * (10 ** SOL_DECIMALS))
    const solAmount = bestRouteInfo.inAmount / (10 ** SOL_DECIMALS)
    const uxdAmount = bestRouteInfo.outAmount / (10 ** UXD_DECIMALS)
    const solPrice = uxdAmount / solAmount
    return solPrice
  } catch (error) {
    console.log(error)
    return null
  }
}

/**
 * @returns Price diff percentage
 */
export const getPriceDifference = async (uxdChainBalance: number, mangoWrapper: MangoWrapper, jupiterWrapper: JupiterWrapper) => {
  const uxdUiBalance = getUiAmount(uxdChainBalance, UXD_DECIMALS)

  const [mangoPrice, solUiAmount] = MangoWrapper.getSolPerpPrice(uxdUiBalance, mangoWrapper.asks)
  const jupiterPrice = await getSolVsUxdJupiterPrice(jupiterWrapper, solUiAmount)

  if (!jupiterPrice) {
    return -1
  }

  const priceDiff = ((jupiterPrice / mangoPrice - 1) * 100).toFixed(2)
  return Number(priceDiff)
}
