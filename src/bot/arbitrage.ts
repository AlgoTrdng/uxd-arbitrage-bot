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
import { syncSolBalance, syncUxdBalance } from './balance'

/**
 * @returns Price diff percentage
 */
const calculatePriceDiff = async (uxdChainBalance: number, mangoWrapper: MangoWrapper, jupiterWrapper: JupiterWrapper) => {
  const uxdUiBalance = getUiAmount(uxdChainBalance, UXD_DECIMALS)

  const [mangoPrice, solUiAmount] = MangoWrapper.getSolPerpPrice(uxdUiBalance, mangoWrapper.asks)
  const jupiterPrice = await jupiterWrapper.getSolToUxdPrice(solUiAmount)
  const priceDiff = ((jupiterPrice / mangoPrice - 1) * 100).toFixed(2)
  return Number(priceDiff)
}

// TODO: Update balances after every successful transaction
const executeRedemption = async (
  connection: Connection,
  uxdWrapper: UxdWrapper,
  mangoWrapper: MangoWrapper,
  jupiterWrapper: JupiterWrapper,
) => {
  const preArbitrageUxdBalance = state.uxdChainBalance
  const uxdUiBalance = getUiAmount(preArbitrageUxdBalance, UXD_DECIMALS)
  console.log('⚠ Starting redemption with', uxdUiBalance)
  let redemptionSignature = await redeem(connection, uxdUiBalance, uxdWrapper)
  await syncUxdBalance(connection)

  while (!redemptionSignature || preArbitrageUxdBalance <= state.uxdChainBalance) {
    console.log('⚠ Repeating redemption')
    const currentPriceDiff = await calculatePriceDiff(uxdUiBalance, mangoWrapper, jupiterWrapper)

    if (currentPriceDiff < config.minimumPriceDiff) {
      state.appStatus.value = 'scanning'
      return false
    }

    await wait()
    redemptionSignature = await redeem(connection, state.uxdChainBalance, uxdWrapper)
    await syncUxdBalance(connection)
  }

  return true
}

const executeSwap = async (connection: Connection, jupiterWrapper: JupiterWrapper) => {
  console.log('💱 Starting swap')
  await syncSolBalance(connection)

  const solUiBalance = getUiAmount(state.solChainBalance, SOL_DECIMALS)
  let swapResult = await swapSolToUxd(jupiterWrapper, solUiBalance)

  while (!swapResult) {
    console.log('💱 Repeating swap')
    if (state.wrappedSolChainBalance > 0) {
      const preCloseSolBalance = state.solChainBalance
      let closeAccountSignature = await swapWSolToSol(connection)
      await syncSolBalance(connection)

      // SOL balance before close account transaction is >= than after, transaction failed
      while (!closeAccountSignature || preCloseSolBalance >= state.solChainBalance) {
        await wait()
        closeAccountSignature = await swapWSolToSol(connection)
        await syncSolBalance(connection)
      }
    }

    await wait()
    swapResult = await swapSolToUxd(jupiterWrapper, solUiBalance)
  }
}

export const startArbitrageLoop = async (connection: Connection, intervalMs: number) => {
  const mangoWrapper = await MangoWrapper.init()
  const jupiterWrapper = await JupiterWrapper.init(connection)
  const uxdWrapper = await UxdWrapper.init(connection)

  mangoWrapper.watchSolPerpAsks()

  await wait(intervalMs) // wait for all connections

  while (true) {
    if (state.appStatus.value !== 'scanning' || state.uxdChainBalance < 10_000_000) {
      return
    }

    const priceDiff = await calculatePriceDiff(state.uxdChainBalance, mangoWrapper, jupiterWrapper)
    console.log('👋 Price diff: ', priceDiff)

    if (priceDiff > config.minimumPriceDiff) {
      console.log('🟢 Starting arbitrage')
      state.appStatus.value = 'inArbitrage'

      // If price difference gets too low while executing redemption, stop arbitrage and continue scanning
      const shouldContinueArbitrage = await executeRedemption(connection, uxdWrapper, mangoWrapper, jupiterWrapper)

      if (!shouldContinueArbitrage) {
        console.log('😡 Stopping arbitrage, low price diff')
        await wait(intervalMs)
        continue
      }

      await executeSwap(connection, jupiterWrapper)
      await syncUxdBalance(connection)
      state.appStatus.value = 'scanning'
      console.log('👍 Arbitrage successful')
    }

    await wait(intervalMs)
  }
}
