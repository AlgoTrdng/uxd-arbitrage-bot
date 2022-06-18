import { Connection } from '@solana/web3.js'

import { Wrappers } from '../../lib/wrappers'
import { executeRedemption, executeSwap } from './utils'
import { AppStatuses, state } from '../../state'
import { getPriceDifference } from '../../lib/utils/getPriceDifference'
import { wait } from '../../lib/utils/wait'
import { emitEvent } from '../../lib/utils/eventEmitter'
import config from '../../app.config'

export const startArbitrageLoop = async (connection: Connection, intervalMs: number, wrappers: Wrappers) => {
  const { jupiterWrapper, mangoWrapper, uxdWrapper } = wrappers

  mangoWrapper.watchSolPerpAsks()
  // wait for ^ websocket to establish
  await wait(5000)

  while (true) {
    await wait(intervalMs)
    if (state.appStatus.value !== AppStatuses.SCANNING) {
      continue
    }

    const priceDiff = await getPriceDifference(state.uxdChainBalance, mangoWrapper, jupiterWrapper)
    console.log('👋 Price diff: ', priceDiff)

    if (priceDiff > config.minimumPriceDiff) {
      state.appStatus.value = AppStatuses.REDEEMING
      emitEvent('arbitrage-start', state.uxdChainBalance)

      // If price difference gets too low while executing redemption, stop arbitrage and continue scanning
      const shouldContinueArbitrage = await executeRedemption(
        connection,
        uxdWrapper,
        mangoWrapper,
        jupiterWrapper,
      )

      if (!shouldContinueArbitrage) {
        console.log('😡 Stopping arbitrage, low price diff')
        state.appStatus.value = AppStatuses.SCANNING
        continue
      }

      state.appStatus.value = AppStatuses.SWAPPING
      await executeSwap(connection, jupiterWrapper)
      emitEvent('arbitrage-success', state.uxdChainBalance)

      state.appStatus.value = AppStatuses.SCANNING
    }
  }
}
