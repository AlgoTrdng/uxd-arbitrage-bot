import { SOL_DECIMALS } from '@uxd-protocol/uxd-client'

import { JupiterWrapper } from '../wrappers'
import { MINIMUM_SOL_CHAIN_AMOUNT, mint } from '../../constants'
import { getChainAmount } from '../utils/amount'
import { force } from '../utils/force'

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
  const swapResult = await force(
    () => {
      console.log('Swapping SOL to UXD')
      return jupiterWrapper.swap(routeInfo)
    },
    { wait: 200 },
  )
  return swapResult as SwapResultSuccess | null
}
