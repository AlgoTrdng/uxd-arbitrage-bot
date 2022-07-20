import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { Wrappers } from '../lib/solana'
import { AppStatuses, ArbitrageType, state } from '../state'
import { wait } from '../lib/utils/wait'
import { emitEvent } from '../lib/utils/eventEmitter'
import { MINIMUM_SOL_CHAIN_AMOUNT, mint } from '../constants'
import { getChainAmount, getUiAmount } from '../lib/utils/amount'
import { closeWrappedSolATA } from '../lib/actions/closeWrappedSolATA'
import { fetchSplBalance } from '../lib/utils/fetchSplBalance'
import { forceOnError } from '../lib/utils/force'
import config from '../app.config'
import { simulateMint, simulateRedeem } from '../lib/utils/uxdSwap'
import { SendTxResponse, sendAndConfirmTransaction } from '../lib/actions/helpers'

const calculatePriceDiff = (input: number, output: number) => (
  Number(((output / input - 1) * 100).toFixed(2))
)

export const startArbitrageLoop = async (connection: Connection, intervalMs: number, wrappers: Wrappers) => {
  const { jupiterWrapper, mangoWrapper, uxdWrapper } = wrappers

  /**
   * Simulate redemption arbitrage
   * UXD to SOL on Mango
   * SOL to UXD on Jupiter
   */
  const getRedeemPriceDifference = async (uxdUiBalance: number) => {
    const redeemOutputUi = simulateRedeem({
      orderbook: mangoWrapper.asks,
      inputAmountUi: uxdUiBalance,
    })
    const swapOutputUi = await jupiterWrapper.fetchOutput({
      inputUiAmount: redeemOutputUi,
      inputMintAddress: mint.SOL,
      outputMintAddress: mint.UXD,
      inputDecimals: SOL_DECIMALS,
      outputDecimals: UXD_DECIMALS,
    })

    if (!swapOutputUi) {
      return -1
    }

    return calculatePriceDiff(uxdUiBalance, swapOutputUi)
  }

  /**
   * Simulate mint arbitrage
   * UXD to SOL on Jupiter
   * SOL to UXD on Mango
   */
  const getMintPriceDifference = async (uxdUiBalance: number) => {
    const swapOutputUi = await jupiterWrapper.fetchOutput({
      inputUiAmount: uxdUiBalance,
      inputMintAddress: mint.UXD,
      outputMintAddress: mint.SOL,
      inputDecimals: UXD_DECIMALS,
      outputDecimals: SOL_DECIMALS,
    })

    if (!swapOutputUi) {
      return {
        priceDiff: -1,
        price: null,
        swapOutputUi: null,
      }
    }

    const mintOutputUi = simulateMint({
      orderbook: mangoWrapper.bids,
      inputAmountUi: swapOutputUi,
    })

    return {
      priceDiff: calculatePriceDiff(uxdUiBalance, mintOutputUi),
      price: Number((mintOutputUi / swapOutputUi).toFixed(4)),
      swapOutputUi,
    }
  }

  while (true) {
    await wait(intervalMs)
    if (state.appStatus.value !== AppStatuses.SCANNING) {
      continue
    }

    const uxdUiBalance = getUiAmount(state.uxdChainBalance, UXD_DECIMALS)
    const safeInputAmount = uxdUiBalance - 1
    const [
      mintSimulationResult,
      redeemPriceDiff,
    ] = await Promise.all([
      getMintPriceDifference(safeInputAmount),
      getRedeemPriceDifference(safeInputAmount),
    ])

    const { priceDiff: mintPriceDiff } = mintSimulationResult

    console.log({
      mintPriceDiff,
      redeemPriceDiff,
    })

    // if both requests failed or price diffs are lower, continue
    if (
      mintPriceDiff < config.minimumPriceDiff
      && redeemPriceDiff < config.minimumPriceDiff
    ) {
      continue
    }

    const type: ArbitrageType = mintPriceDiff > redeemPriceDiff ? 'minting' : 'redeeming'
    emitEvent('arbitrage-start', {
      uxdChainBalance: state.uxdChainBalance,
      type,
    })

    // eslint-disable-next-line default-case
    switch (type) {
      case 'minting': {
        state.appStatus.value = AppStatuses.MINTING
        console.log('💱 Executing mint arbitrage with: ', safeInputAmount)
        // ------------
        // EXECUTE SWAP
        let swapResult = await jupiterWrapper.fetchRouteInfoAndSwap({
          swapChainAmount: getChainAmount(safeInputAmount, UXD_DECIMALS),
          inputMint: mint.UXD,
          outputMint: mint.SOL,
        })

        while (!swapResult) {
          await wait()
          const wSolChainBalance = await forceOnError(
            () => fetchSplBalance(connection, mint.SOL),
            500,
          )
          // Swap failed to close WSOL account
          if (wSolChainBalance) {
            await closeWrappedSolATA(connection)
            break
          }

          await state.syncUxdBalance(connection)
          // If current UXD balance is lower than input, swap was successful
          if (state.uxdChainBalance < safeInputAmount) {
            break
          }

          swapResult = await jupiterWrapper.fetchRouteInfoAndSwap({
            swapChainAmount: getChainAmount(safeInputAmount, SOL_DECIMALS),
            inputMint: mint.UXD,
            outputMint: mint.SOL,
          })
        }

        // Get SOL balance, at this point SOL balance us higher than 0.15 SOL
        let solChainBalance = 0
        while (solChainBalance < MINIMUM_SOL_CHAIN_AMOUNT + 50_000_000) {
          solChainBalance = await forceOnError(
            () => connection.getBalance(config.SOL_PUBLIC_KEY),
            500,
          )
          await wait()
        }

        // ------------
        // EXECUTE MINT
        const mintInputBalance = getUiAmount(solChainBalance - MINIMUM_SOL_CHAIN_AMOUNT, SOL_DECIMALS)
        // Real input amount that UXD program will use
        const realMintInputBalance = Math.floor(mintInputBalance * 100) / 100

        const executeMint = async () => {
          let mintResponse: SendTxResponse = null

          do {
            if (!mintResponse) {
              await wait()
            }

            const mintTx = await uxdWrapper.createMintRawTransaction(realMintInputBalance)
            mintResponse = await sendAndConfirmTransaction(connection, mintTx)
          } while (!mintResponse)

          return mintResponse
        }

        const [mintResponse] = await Promise.all([
          executeMint(),
          // Swap the remaining SOL amount back to UXD
          jupiterWrapper.fetchRouteInfoAndSwap({
            swapChainAmount: getChainAmount(mintInputBalance - realMintInputBalance, SOL_DECIMALS),
            inputMint: mint.SOL,
            outputMint: mint.UXD,
          }),
        ])

        state.uxdChainBalance = mintResponse.uxdChainBalance

        emitEvent('arbitrage-success', state.uxdChainBalance)
        break
      }
      case 'redeeming': {
        state.appStatus.value = AppStatuses.REDEEMING
        console.log('💱 Executing redeem arbitrage with: ', safeInputAmount)
        // -----------------
        // EXECUTE REDEMPTION
        let redeemResponse: SendTxResponse = null

        // Try to send TX until:
        //  - it is successful
        //  - price diff is lower than minimum threshold
        while (true) {
          const redeemTx = await uxdWrapper.createRedeemRawTransaction(safeInputAmount)
          redeemResponse = await sendAndConfirmTransaction(connection, redeemTx)

          if (redeemResponse) {
            break
          }

          const currentPriceDiff = await getRedeemPriceDifference(safeInputAmount)
          if (currentPriceDiff < config.minimumPriceDiff) {
            break
          }
        }

        if (!redeemResponse) {
          // Price diff got too low, continue scanning
          console.log('🚨 Price diff too low, aborting redemption')
          break
        }

        const {
          // UXD balance after redemption, will be close to 0
          uxdChainBalance: postRedeemUxdAmount,
          solChainBalance: redeemOutputSolAmount,
        } = redeemResponse

        // ------------
        // EXECUTE SWAP
        const safeSolAmount = redeemOutputSolAmount - MINIMUM_SOL_CHAIN_AMOUNT
        let swapResult = await jupiterWrapper.fetchRouteInfoAndSwap({
          swapChainAmount: safeSolAmount,
          inputMint: mint.SOL,
          outputMint: mint.UXD,
        })

        while (!swapResult) {
          await wait()
          // Jupiter did not return result, but swap was successful
          await state.syncUxdBalance(connection)
          if (state.uxdChainBalance > postRedeemUxdAmount) {
            break
          }

          // Check if swapped failed after it swapped to WSOL
          // If so, close WSOL account
          const wSolChainBalance = await forceOnError(
            () => fetchSplBalance(connection, mint.SOL),
            500,
          )
          if (wSolChainBalance) {
            await closeWrappedSolATA(connection)
          }

          swapResult = await jupiterWrapper.fetchRouteInfoAndSwap({
            inputMint: mint.SOL,
            outputMint: mint.UXD,
            swapChainAmount: safeSolAmount,
          })
        }

        // -------------------------------
        // SYNC BALANCE WITH ACCOUNT STATE
        if (swapResult) {
          await state.syncUxdBalance(connection)

          // new balance can not be lower than jupiter output if the swap was successful
          while (state.uxdChainBalance < swapResult.outputAmount) {
            await wait()
            await state.syncUxdBalance(connection)
          }
        }

        emitEvent('arbitrage-success', state.uxdChainBalance)
      }
    }

    state.appStatus.value = AppStatuses.SCANNING
  }
}
