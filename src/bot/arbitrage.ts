import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { JupiterWrapper } from '../wrappers/jupiter'
import { MangoWrapper } from '../wrappers/mango'
import { state } from '../state'
import { redeem } from '../lib/actions/redeem'
import { getUiAmount } from '../lib/utils/amount'
import { UxdWrapper } from '../wrappers/uxd'
import { swapSolToUxd, swapWSolToSol } from '../lib/actions/swap'
import { wait } from '../lib/utils/wait'
import config from '../app.config'

/**
 * @returns Price diff percentage
 */
const calculatePriceDiff = async (uxdUiBalance: number, mangoWrapper: MangoWrapper, jupiterWrapper: JupiterWrapper) => {
  const [mangoPrice, solUiAmount] = MangoWrapper.getSolPerpPrice(uxdUiBalance, mangoWrapper.asks)
  const jupiterPrice = await jupiterWrapper.getSolToUxdPrice(solUiAmount)
  const priceDiff = ((jupiterPrice / mangoPrice - 1) * 100).toFixed(2)
  return Number(priceDiff)
}

export const startArbitrageLoop = async (connection: Connection, intervalMs: number) => {
  const mangoWrapper = await MangoWrapper.init()
  const jupiterWrapper = await JupiterWrapper.init(connection)
  const uxdWrapper = await UxdWrapper.init(connection)

  mangoWrapper.watchSolPerpAsks()

  setInterval(async () => {
    if (state.appStatus.value !== 'scanning') {
      return
    }

    const uxdUiBalance = getUiAmount(state.uxdChainBalance, UXD_DECIMALS)
    const priceDiff = await calculatePriceDiff(uxdUiBalance, mangoWrapper, jupiterWrapper)

    if (priceDiff > config.minimumPriceDiff) {
      state.appStatus.value = 'inArbitrage'
      const startBalance = state.uxdChainBalance

      let redemptionSignature = await redeem(connection, uxdUiBalance, uxdWrapper)

      while (!redemptionSignature || startBalance <= state.uxdChainBalance) {
        await wait(200)
        redemptionSignature = await redeem(connection, uxdUiBalance, uxdWrapper)
      }

      const solUiAmount = getUiAmount(state.solChainBalance, SOL_DECIMALS)
      let swapResult = await swapSolToUxd(jupiterWrapper, solUiAmount)

      while (!swapResult) {
        if (state.wrappedSolChainBalance > 0) {
          let closeAccountSignature = await swapWSolToSol(connection)

          while (!closeAccountSignature) {
            await wait(200)
            closeAccountSignature = await swapWSolToSol(connection)
          }
        }

        await wait(200)
        swapResult = await swapSolToUxd(jupiterWrapper, uxdUiBalance)
      }

      state.appStatus.value = 'scanning'
    }
  }, intervalMs)
}
