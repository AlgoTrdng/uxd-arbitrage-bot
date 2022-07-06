import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'
import { Connection } from '@solana/web3.js'

import { getChainAmount, getUiAmount } from '../lib/utils/amount'
import { AppStatuses, state } from '../state'
import { JupiterWrapper } from '../lib/solana'
import { mint } from '../constants'
import { wait } from '../lib/utils/wait'
import { emitEvent } from '../lib/utils/eventEmitter'
import config from '../app.config'

export const watchStatusAndReBalance = (connection: Connection, jupiterWrapper: JupiterWrapper) => {
  state.appStatus.watch(async (currentStatus, prevStatus) => {
    if (currentStatus !== AppStatuses.SCANNING && prevStatus !== AppStatuses.SWAPPING) {
      return
    }

    const { uxdChainBalance } = state
    const uxdUiBalance = getUiAmount(uxdChainBalance, UXD_DECIMALS)

    if (uxdUiBalance < config.maximumUxdUiBalance) {
      return
    }

    state.appStatus.value = AppStatuses.RE_BALANCING
    const startUxdChainBalance = uxdChainBalance

    const uxdChainAmountToSwap = uxdChainBalance - getChainAmount(config.defaultUxdUiBalance, UXD_DECIMALS)
    let swapResult = await jupiterWrapper.fetchRouteInfoAndSwap({
      inputMint: mint.UXD,
      outputMint: mint.USDC,
      swapChainAmount: uxdChainAmountToSwap,
    })

    while (!swapResult) {
      await state.syncUxdBalance(connection)
      if (state.uxdChainBalance < startUxdChainBalance) {
        break
      }

      await wait(200)
      swapResult = await jupiterWrapper.fetchRouteInfoAndSwap({
        inputMint: mint.UXD,
        outputMint: mint.USDC,
        swapChainAmount: uxdChainAmountToSwap,
      })
    }

    const minUxdUiBalance = getChainAmount(config.defaultUxdUiBalance + 1, UXD_DECIMALS)
    while (swapResult && state.uxdChainBalance > minUxdUiBalance) {
      await state.syncUxdBalance(connection)
    }

    emitEvent('re-balance-success', {
      preUxdChainBalance: startUxdChainBalance,
      postUxdChainBalance: state.uxdChainBalance,
    })
    state.appStatus.value = AppStatuses.SCANNING
  })
}
