import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { getUiAmount } from '../lib/utils/amount'
import { state } from '../state'

export const recordArbitrageTrades = () => {
  let preArbitrageUiBalance: number | null = null

  state.appStatus.watch((newStatus, prevStatus) => {
    // Start arbitrage
    if (newStatus === 'inArbitrage') {
      preArbitrageUiBalance = getUiAmount(state.uxdChainBalance, UXD_DECIMALS)
      return
    }

    // Remaining SOL from previous failed redemption was swapped for UXD
    if (newStatus === 'scanning' && prevStatus === 'swappingRemainingSol') {
      const postArbitrageUiBalance = getUiAmount(state.uxdChainBalance, UXD_DECIMALS)
      const profitBps = postArbitrageUiBalance / preArbitrageUiBalance! - 1
      const profitPercentage = Number((profitBps * 100).toFixed(2))

      console.log(`Unsuccessful arbitrage, profit: ${profitPercentage}%`)

      preArbitrageUiBalance = null
      return
    }

    // Arbitrage was successful
    if (newStatus === 'scanning' && prevStatus === 'inArbitrage') {
      const postArbitrageUiBalance = getUiAmount(state.uxdChainBalance, UXD_DECIMALS)
      const profitBps = postArbitrageUiBalance / preArbitrageUiBalance! - 1
      const profitPercentage = Number((profitBps * 100).toFixed(2))

      console.log(`Successful arbitrage, profit: ${profitPercentage}%`)

      preArbitrageUiBalance = null
    }
  })
}
