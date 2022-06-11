import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { getUiAmount } from '../lib/utils/amount'
import { state } from '../state'

export const recordArbitrageTrades = () => {
  let preArbitrageUiBalance: number | null = null
  let failedArbitrageCount = 0

  state.appStatus.watch((newStatus) => {
    // Start arbitrage
    if (newStatus === 'inArbitrage') {
      preArbitrageUiBalance = getUiAmount(state.uxdChainBalance, UXD_DECIMALS)
      return
    }

    // Arbitrage failed, price difference has fallen too low
    if (newStatus === 'scanning__arbitrageFail') {
      preArbitrageUiBalance = null
      failedArbitrageCount += 1
      console.log('Current count of failed trades', failedArbitrageCount)
      return
    }

    // Arbitrage was successful
    if (newStatus === 'scanning' && preArbitrageUiBalance) {
      const postArbitrageUiBalance = getUiAmount(state.uxdChainBalance, UXD_DECIMALS)
      const profitBps = postArbitrageUiBalance / preArbitrageUiBalance - 1
      const profitPercentage = Number((profitBps * 100).toFixed(2))

      console.log(`Successful arbitrage, profit: ${profitPercentage}%`)

      preArbitrageUiBalance = null
    }
  })
}
