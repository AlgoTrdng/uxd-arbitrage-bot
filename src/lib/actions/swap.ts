// TODO: Use jupiterWrapper.fetchRouteAndSwap instead of this
import { SOL_DECIMALS } from '@uxd-protocol/uxd-client'
import { PublicKey } from '@solana/web3.js'

import { JupiterWrapper } from '../wrappers'
import { MINIMUM_SOL_CHAIN_AMOUNT, mint } from '../../constants'
import { getChainAmount } from '../utils/amount'
import { force } from '../utils/force'

type SwapHelperConfig = {
  inputMint: PublicKey
  outputMint: PublicKey
  swapAmount: number
}

export const jupiterSwap = async (jupiterWrapper: JupiterWrapper, config: SwapHelperConfig) => {
  const routeInfo = await jupiterWrapper.fetchBestRouteInfo(
    config.inputMint,
    config.outputMint,
    config.swapAmount,
  )
  const swapResult = await force(
    () => jupiterWrapper.swap(routeInfo),
    { wait: 200 },
  )
  return swapResult as SwapResultSuccess | null
}

type SwapResultSuccess = {
  txid: string
  inputAmount: number
  outputAmount: number
}

export const swapSolToUxd = async (jupiterWrapper: JupiterWrapper, solUiBalance: number) => {
  const safeSolAmount = getChainAmount(solUiBalance, SOL_DECIMALS) - MINIMUM_SOL_CHAIN_AMOUNT
  const swapResult = await jupiterSwap(
    jupiterWrapper,
    {
      inputMint: mint.SOL,
      outputMint: mint.UXD,
      swapAmount: safeSolAmount,
    },
  )
  return swapResult
}
