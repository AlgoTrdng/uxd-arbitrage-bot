import { setTimeout } from 'timers/promises'
import { Transaction } from '@solana/web3.js'

import { getRedemptionPriceDifference, initPriceDiffsMAs, updatePriceDiffsAndFindArb } from './core/priceDiffs'
import { Directions, fetchBestRouteAndExecuteSwap, initJupiter } from './core/jupiter'
import { subscribeToMangoAsks } from './core/uxd/mango'
import { floor, toRaw, toUi } from './helpers/amount'
import { Decimals } from './constants'
import { getSolBalanceRaw, getUxdBalanceRaw } from './helpers/getBalance'
import { config } from './config'
import { buildMintRawTransaction, buildRedeemRawTransaction, initUxdClient } from './core/uxd'
import { sendAndConfirmTransaction, SuccessResponse, TransactionResponse } from './helpers/sendTransaction'
import { checkAndExecuteReBalance } from './core/reBalance'

/* eslint-disable no-redeclare */
function executeUxdTransaction(
  buildTransaction: () => Promise<Transaction>,
): Promise<SuccessResponse>
function executeUxdTransaction(
  buildTransaction: () => Promise<Transaction>,
  shouldAbort: () => boolean | Promise<boolean>,
): Promise<SuccessResponse | null>
async function executeUxdTransaction(
  buildTransaction: () => Promise<Transaction>,
  shouldAbort?: () => boolean | Promise<boolean>,
) {
  let mintTransaction = await buildTransaction()
  let response = await sendAndConfirmTransaction(mintTransaction)

  while (!response.success) {
    if (shouldAbort && await shouldAbort()) {
      return null
    }

    await setTimeout(500)

    if (response.err === TransactionResponse.BLOCK_HEIGHT_EXCEEDED) {
      mintTransaction = await buildTransaction()
    }
    response = await sendAndConfirmTransaction(mintTransaction)
  }

  return response
}
/* eslint-enable no-redeclare */

const main = async () => {
  const jupiter = await initJupiter()
  const uxdClient = await initUxdClient()
  const getOrderbookSide = await subscribeToMangoAsks()

  const priceDiffs = initPriceDiffsMAs()
  // -------------
  // MAIN BOT LOOP
  while (true) {
    await setTimeout(10_000)
    const arbConfig = await updatePriceDiffsAndFindArb({
      jupiter,
      priceDiffsMAs: priceDiffs,
      getOrderbookSide,
    })

    console.log({
      priceDiffs: arbConfig?.priceDiffs,
      direction: arbConfig?.arbOpportunity.direction,
    })

    if (!arbConfig) {
      continue
    }

    const { inputAmountUi: maxInputAmountUi, direction } = arbConfig.arbOpportunity

    const preArbUxdBalanceRaw = await getUxdBalanceRaw()
    const preArbUxdBalanceUi = toUi(preArbUxdBalanceRaw, Decimals.USD)

    const inputAmountUi = maxInputAmountUi > preArbUxdBalanceUi
      ? preArbUxdBalanceUi - 1
      : maxInputAmountUi

    console.log(
      `Starting ${direction} arbitrage:\n Suggested input: ${
        maxInputAmountUi
      } UXD\n Real input: ${
        inputAmountUi
      } UXD`,
    )

    switch (direction) {
      case Directions.MINT: {
        // Execute swap
        await (async () => {
          const swapParams = {
            jupiter,
            direction,
            amountRaw: toRaw(inputAmountUi, Decimals.USD),
          }
          let swapResult = await fetchBestRouteAndExecuteSwap(swapParams)

          while (!swapResult) {
            await setTimeout(1000)

            const postSwapBalance = await getUxdBalanceRaw()
            if (postSwapBalance < preArbUxdBalanceRaw) {
              break
            }

            swapResult = await fetchBestRouteAndExecuteSwap(swapParams)
          }
        })()

        // Get SOL input amount
        let solBalanceRaw = await getSolBalanceRaw()
        while (solBalanceRaw <= config.minSolAmountRaw) {
          await setTimeout(500)
          solBalanceRaw = await getSolBalanceRaw()
        }
        const solInputAmountUi = toUi(solBalanceRaw - config.minSolAmountRaw, Decimals.SOL)
        const realInputAmountUi = floor(solInputAmountUi, 2)

        // Mint UXD
        const postMintUxdBalanceRaw = await (async () => {
          const response = await executeUxdTransaction(
            () => buildMintRawTransaction(realInputAmountUi, uxdClient),
          )
          return response.data.uxdRawAmount
        })()

        // Swap remaining SOL
        await (async () => {
          const remainingSolAmountUi = solInputAmountUi - realInputAmountUi
          await fetchBestRouteAndExecuteSwap({
            jupiter,
            direction: Directions.REDEMPTION,
            amountRaw: toRaw(remainingSolAmountUi, Decimals.SOL),
          })
        })()

        // Get balance and log result
        let postArbUxdBalanceRaw = await getUxdBalanceRaw()
        while (postArbUxdBalanceRaw < postMintUxdBalanceRaw) {
          await setTimeout(1000)
          postArbUxdBalanceRaw = await getUxdBalanceRaw()
        }

        console.log(
          `Executed ${direction} arbitrage:\n preArbBalance: ${
            toUi(preArbUxdBalanceRaw, Decimals.USD)
          }\n postArbBalance: ${
            toUi(postArbUxdBalanceRaw, Decimals.USD)
          }`,
        )

        await checkAndExecuteReBalance(toUi(postArbUxdBalanceRaw, Decimals.USD), jupiter)
        break
      }
      case Directions.REDEMPTION: {
        // Redeem
        const redeemResponse = await executeUxdTransaction(
          () => buildRedeemRawTransaction(inputAmountUi, uxdClient),
          async () => {
            const priceDiff = await getRedemptionPriceDifference({
              jupiter,
              inputAmountUi,
              orderbook: getOrderbookSide('asks'),
              forceFetch: true,
            })
            console.log({ redeemFailPriceDiff: priceDiff })
            return config.minPriceDiff > priceDiff
          },
        )
        if (!redeemResponse) {
          console.log('Aborting redemption')
          break
        }

        const { uxdRawAmount: preSwapUxdBalanceRaw } = redeemResponse.data
        const redeemedAmountRaw = redeemResponse.data.solRawDifference + 5000

        // Swap back to USD
        let postArbUxdBalanceRaw = await (async () => {
          const swapParams = {
            jupiter,
            direction,
            amountRaw: redeemedAmountRaw,
          }
          let swapResult = await fetchBestRouteAndExecuteSwap(swapParams)

          while (!swapResult) {
            await setTimeout(500)

            const uxdBalance = await getUxdBalanceRaw()
            if (uxdBalance > preSwapUxdBalanceRaw) {
              // If current balance is higher then pre-swap balance,
              // swap was a success
              return uxdBalance
            }

            swapResult = await fetchBestRouteAndExecuteSwap(swapParams)
          }

          return null
        })()

        // Get balance and log result
        while (!postArbUxdBalanceRaw || postArbUxdBalanceRaw <= preSwapUxdBalanceRaw) {
          postArbUxdBalanceRaw = await getUxdBalanceRaw()
          await setTimeout(1000)
        }

        console.log(
          `Executed ${direction} arbitrage:\n preArbBalance: ${
            toUi(preArbUxdBalanceRaw, Decimals.USD)
          }\n postArbBalance: ${
            toUi(postArbUxdBalanceRaw, Decimals.USD)
          }`,
        )

        await checkAndExecuteReBalance(toUi(postArbUxdBalanceRaw, Decimals.USD), jupiter)
        break
      }
      default: throw Error(`Unknown arb direction: ${direction}`)
    }
  }
}

main()
