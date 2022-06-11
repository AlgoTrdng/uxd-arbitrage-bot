import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import {
  Wrappers,
  JupiterWrapper,
  MangoWrapper,
  UxdWrapper,
} from '../wrappers'
import { state } from '../state'
import { sendAndAwaitRawRedeemTransaction } from '../lib/actions/redeem'
import { getUiAmount } from '../lib/utils/amount'
import { swapSolToUxd } from '../lib/actions/swap'
import { wait } from '../lib/utils/wait'
import config from '../app.config'
import { syncSolBalance, syncUxdBalance } from './balance'
import { MINIMUM_SOL_CHAIN_AMOUNT, MINIMUM_UXD_CHAIN_AMOUNT } from '../constants'

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

const executeRedemption = async (
  connection: Connection,
  uxdWrapper: UxdWrapper,
  mangoWrapper: MangoWrapper,
  jupiterWrapper: JupiterWrapper,
) => {
  const preArbitrageUxdBalance = state.uxdChainBalance
  const uxdUiBalance = getUiAmount(preArbitrageUxdBalance, UXD_DECIMALS)
  console.log('⚠ Starting redemption with', uxdUiBalance)

  const serializedTransaction = await uxdWrapper.createSignedRedeemRawTransaction(uxdUiBalance)
  let postRedemptionBalances = await sendAndAwaitRawRedeemTransaction(connection, serializedTransaction)
  while (!postRedemptionBalances) {
    console.log('⚠ Repeating redemption')
    const currentPriceDiff = await calculatePriceDiff(uxdUiBalance, mangoWrapper, jupiterWrapper)

    if (currentPriceDiff < config.minimumPriceDiff) {
      return false
    }

    await wait()
    postRedemptionBalances = await sendAndAwaitRawRedeemTransaction(connection, serializedTransaction)
  }

  const { solChainBalance, uxdChainBalance } = postRedemptionBalances
  state.solChainBalance = solChainBalance
  state.uxdChainBalance = uxdChainBalance

  return true
}

const executeSwap = async (connection: Connection, jupiterWrapper: JupiterWrapper) => {
  const solUiBalance = getUiAmount(state.solChainBalance, SOL_DECIMALS)

  console.log('💱 Starting swap', solUiBalance)
  let swapResult = await swapSolToUxd(jupiterWrapper, solUiBalance)

  while (!swapResult) {
    console.log('💱 Repeating swap')
    // if (state.wrappedSolChainBalance > 0) {
    //   const preCloseSolBalance = state.solChainBalance
    //   let closeAccountSignature = await swapWSolToSol(connection)
    //   await syncSolBalance(connection)

    //   // SOL balance before close account transaction is >= than after, transaction failed
    //   while (!closeAccountSignature || preCloseSolBalance >= state.solChainBalance) {
    //     await wait()
    //     closeAccountSignature = await swapWSolToSol(connection)
    //     await syncSolBalance(connection)
    //   }
    // }

    await wait()
    swapResult = await swapSolToUxd(jupiterWrapper, solUiBalance)
  }

  await syncSolBalance(connection)
  while (state.solChainBalance > MINIMUM_SOL_CHAIN_AMOUNT) {
    await syncSolBalance(connection)
  }

  await syncUxdBalance(connection)
  while (state.uxdChainBalance < MINIMUM_UXD_CHAIN_AMOUNT) {
    await syncUxdBalance(connection)
  }
}

export const startArbitrageLoop = async (connection: Connection, intervalMs: number, wrappers: Wrappers) => {
  const { jupiterWrapper, mangoWrapper, uxdWrapper } = wrappers

  mangoWrapper.watchSolPerpAsks()

  while (true) {
    await wait(intervalMs)

    console.log('Scan', state.uxdChainBalance)
    if (!state.appStatus.value.startsWith('scanning')) {
      continue
    }

    const priceDiff = await calculatePriceDiff(state.uxdChainBalance, mangoWrapper, jupiterWrapper)
    console.log('👋 Price diff: ', priceDiff)

    if (priceDiff > config.minimumPriceDiff) {
      state.appStatus.value = 'inArbitrage'

      // If price difference gets too low while executing redemption, stop arbitrage and continue scanning
      const shouldContinueArbitrage = await executeRedemption(
        connection,
        uxdWrapper,
        mangoWrapper,
        jupiterWrapper,
      )

      if (!shouldContinueArbitrage) {
        console.log('😡 Stopping arbitrage, low price diff')
        state.appStatus.value = 'scanning__arbitrageFail'
        continue
      }

      await executeSwap(connection, jupiterWrapper)

      state.appStatus.value = 'scanning'
      console.log('👍 Arbitrage successful', getUiAmount(state.uxdChainBalance, UXD_DECIMALS))
    }
  }
}
