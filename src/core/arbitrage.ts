import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { MangoWrapper, Wrappers } from '../lib/solana'
import { AppStatuses, state } from '../state'
import { wait } from '../lib/utils/wait'
import { emitEvent } from '../lib/utils/eventEmitter'
import { MINIMUM_SOL_CHAIN_AMOUNT, mint } from '../constants'
import { getUiAmount } from '../lib/utils/amount'
import { sendAndConfirmRedeem, SendRedeemTxError } from '../lib/actions/redeem'
import { closeWrappedSolATA } from '../lib/actions/closeWrappedSolATA'
import { fetchSplBalance } from '../lib/utils/fetchSplBalance'
import { force } from '../lib/utils/force'
import config from '../app.config'

export const startArbitrageLoop = async (connection: Connection, intervalMs: number, wrappers: Wrappers) => {
  const { jupiterWrapper, mangoWrapper, uxdWrapper } = wrappers

  mangoWrapper.watchSolPerpAsks()
  // wait for ^ websocket to establish
  await wait(5000)

  /**
   * @returns Price diff percentage
   */
  const getPriceDifference = async (uxdChainBalance: number) => {
    const uxdUiBalance = getUiAmount(uxdChainBalance, UXD_DECIMALS)

    const [mangoPrice, solUiAmount] = MangoWrapper.getSolPerpPrice(uxdUiBalance, mangoWrapper.asks)
    const jupiterPrice = await jupiterWrapper.fetchPrice({
      inputUiAmount: solUiAmount,
      inputDecimals: SOL_DECIMALS,
      inputMintAddress: mint.SOL,
      outputDecimals: UXD_DECIMALS,
      outputMintAddress: mint.UXD,
    })

    if (!jupiterPrice) {
      return -1
    }

    const priceDiff = ((jupiterPrice / mangoPrice - 1) * 100).toFixed(2)
    return Number(priceDiff)
  }

  const executeRedemption = async () => {
    const preArbitrageUxdBalance = state.uxdChainBalance
    const safeUxdUiBalance = getUiAmount(preArbitrageUxdBalance, UXD_DECIMALS) - 1

    let redeemTx = await uxdWrapper.createRedeemRawTransaction(safeUxdUiBalance)
    console.log('⚠ Starting redemption with', safeUxdUiBalance)
    let redeemResponse = await sendAndConfirmRedeem(connection, redeemTx)

    while (typeof redeemResponse === 'string') {
      console.log('⚠ Repeating redemption')

      if (
        redeemResponse === SendRedeemTxError.BLOCK_HEIGHT_EXCEEDED
        || redeemResponse === SendRedeemTxError.ERROR
      ) {
        redeemTx = await uxdWrapper.createRedeemRawTransaction(safeUxdUiBalance)
      }

      const currentPriceDiff = await getPriceDifference(preArbitrageUxdBalance)
      if (currentPriceDiff < config.minimumPriceDiff) {
        return false
      }

      await wait()
      redeemResponse = await sendAndConfirmRedeem(connection, redeemTx)
    }

    const { solChainBalance, uxdChainBalance } = redeemResponse
    state.solChainBalance = solChainBalance
    state.uxdChainBalance = uxdChainBalance

    return true
  }

  const executeSwap = async () => {
    console.log('💱 Starting swap', state.solChainBalance)
    const startUxdBalance = state.uxdChainBalance
    const safeSolAmount = state.solChainBalance - MINIMUM_SOL_CHAIN_AMOUNT
    let swapResult = await jupiterWrapper.fetchRouteInfoAndSwap({
      inputMint: mint.SOL,
      outputMint: mint.UXD,
      swapChainAmount: safeSolAmount,
    })

    while (!swapResult) {
      console.log('💱 Repeating swap', swapResult)

      await state.syncUxdBalance(connection)
      if (state.uxdChainBalance > startUxdBalance) {
        break
      }

      const wSolChainBalance = await force(
        () => fetchSplBalance(connection, mint.SOL),
        { wait: 200 },
      )
      if (wSolChainBalance) {
        console.log('Closing wrapped SOL ATA')
        await closeWrappedSolATA(connection)
      }

      await wait()
      swapResult = await jupiterWrapper.fetchRouteInfoAndSwap({
        inputMint: mint.SOL,
        outputMint: mint.UXD,
        swapChainAmount: safeSolAmount,
      })
    }

    await state.syncSolBalance(connection)
    // + 0.5 SOL to account
    // in case of jupiter swapping lower amount than provided
    while (state.solChainBalance > MINIMUM_SOL_CHAIN_AMOUNT + 50_000_000) {
      await state.syncSolBalance(connection)
      await wait()
    }

    while (swapResult && state.uxdChainBalance < swapResult.outputAmount) {
      await state.syncUxdBalance(connection)
      await wait()
    }
  }

  while (true) {
    await wait(intervalMs)
    if (state.appStatus.value !== AppStatuses.SCANNING) {
      continue
    }

    const priceDiff = await getPriceDifference(state.uxdChainBalance)
    console.log('👋 Price diff: ', priceDiff)

    if (priceDiff > config.minimumPriceDiff) {
      state.appStatus.value = AppStatuses.REDEEMING
      emitEvent('arbitrage-start', state.uxdChainBalance)

      // If price difference gets too low while executing redemption, stop arbitrage and continue scanning
      const shouldContinueArbitrage = await executeRedemption()

      if (!shouldContinueArbitrage) {
        console.log('😡 Stopping arbitrage, low price diff')
        state.appStatus.value = AppStatuses.SCANNING
        continue
      }

      state.appStatus.value = AppStatuses.SWAPPING
      await executeSwap()

      emitEvent('arbitrage-success', state.uxdChainBalance)
      state.appStatus.value = AppStatuses.SCANNING
    }
  }
}
