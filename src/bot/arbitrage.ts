import { Connection } from '@solana/web3.js'

import { JupiterWrapper } from '../wrappers/jupiter'
import { MangoWrapper } from '../wrappers/mango'
import { state } from '../state'

export const startArbitrageLoop = async (connection: Connection, intervalMs: number) => {
  const mangoWrapper = await MangoWrapper.init()
  mangoWrapper.watchSolPerpAsks()

  const jupiterWrapper = await JupiterWrapper.init(connection)

  /**
   * @returns Price diff percentage
   */
  const comparePrices = async (uxdUiBalance: number) => {
    const [mangoPrice, solUiAmount] = MangoWrapper.getSolPerpPrice(uxdUiBalance, mangoWrapper.asks)
    const jupiterPrice = await jupiterWrapper.getSolToUxdPrice(solUiAmount)

    const priceDiff = ((jupiterPrice / mangoPrice - 1) * 100).toFixed(2)
    return Number(priceDiff)
  }

  setInterval(async () => {
    const priceDiff = await comparePrices(state.uxdChainBalance.value)

    if (priceDiff > 0.2) {
      // Execute arbitrage
    }
  }, intervalMs)
}

// startArbitrageLoop(new Connection(config.SOLANA_RPC_ENDPOINT, 'confirmed'), 10_000)
