import { setTimeout } from 'timers/promises'
import { Transaction } from '@solana/web3.js'

import {
  getRedemptionPriceDifference,
  initPriceDiffsMAs,
  updatePriceDiffsAndFindArb,
} from './core/priceDiffs'
import { Directions, fetchBestRouteAndExecuteSwap, initJupiter } from './core/jupiter'
import { subscribeToMangoAsks } from './core/uxd/mango'
import {
  floor,
  round,
  toRaw,
  toUi,
} from './helpers/amount'
import { Decimals } from './constants'
import { getSolBalanceRaw, getUxdBalanceRaw } from './helpers/getBalance'
import { config } from './config'
import { buildMintRawTransaction, buildRedeemRawTransaction, initUxdClient } from './core/uxd'
import {
  sendAndConfirmTransaction,
  SuccessResponse,
  TransactionResponse,
} from './helpers/sendTransaction'
import { checkAndExecuteSolReBalance, checkAndExecuteUxdReBalance } from './core/reBalance'
import { initDiscord, sendArbResultMessage, setActivity } from './logging/discord'
import { saveArbResult } from './logging/firebase'
import { updateStatus } from './logging/status'

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

type ArbitrageResultSuccess = {
  success: true
  postArbUxdAmountRaw: number
}

type ArbitrageResultError = {
  success: false
}

const main = async () => {
  const { channel: discordChannel, client: discordClient } = await initDiscord()
  setActivity(discordClient)

  const jupiter = await initJupiter()
  const uxdClient = await initUxdClient()
  const getOrderbookSide = await subscribeToMangoAsks()

  const priceDiffs = initPriceDiffsMAs()
  // -------------
  // MAIN BOT LOOP
  while (true) {
    await setTimeout(10_000)
    await updateStatus('ping')

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

    const preArbUxdAmountRaw = await getUxdBalanceRaw()
    const preArbUxdAmountUi = toUi(preArbUxdAmountRaw, Decimals.USD)

    const inputAmountUi = maxInputAmountUi > preArbUxdAmountUi
      ? preArbUxdAmountUi - 1
      : maxInputAmountUi

    console.log(
      `Starting ${direction} arbitrage. Suggested input: ${
        maxInputAmountUi
      } UXD, Real input: ${
        inputAmountUi
      } UXD`,
    )
    setActivity(discordClient, direction)
    await updateStatus('startArb')

    // Execute arbitrage
    const arbResult = await (async (): Promise<ArbitrageResultError | ArbitrageResultSuccess> => {
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

              const postSwapSolBalance = await getSolBalanceRaw()
              if (postSwapSolBalance > config.minSolAmountRaw + 20_000_000) {
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

          // Get post arb balance
          let postArbUxdBalanceRaw = await getUxdBalanceRaw()
          while (postArbUxdBalanceRaw < postMintUxdBalanceRaw) {
            await setTimeout(1000)
            postArbUxdBalanceRaw = await getUxdBalanceRaw()
          }

          return {
            success: true,
            postArbUxdAmountRaw: postArbUxdBalanceRaw,
          }
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
            return {
              success: false,
            }
          }

          const { uxdRawAmount: preSwapUxdBalanceRaw } = redeemResponse.data
          const redeemedAmountRaw = redeemResponse.data.solRawDifference - 5000

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

          // Get post arb balance
          while (!postArbUxdBalanceRaw || postArbUxdBalanceRaw <= preSwapUxdBalanceRaw) {
            postArbUxdBalanceRaw = await getUxdBalanceRaw()
            await setTimeout(1000)
          }

          return {
            success: true,
            postArbUxdAmountRaw: postArbUxdBalanceRaw,
          }
        }
        default: throw Error(`Unknown arb direction: ${direction}`)
      }
    })()

    setActivity(discordClient)

    if (!arbResult.success) {
      continue
    }

    // ---------------
    // Log arb results
    const { postArbUxdAmountRaw } = arbResult
    const postArbUxdAmountUi = toUi(postArbUxdAmountRaw, Decimals.USD)

    const oldAmountRounded = round(preArbUxdAmountUi, 2)
    const newAmountRounded = round(postArbUxdAmountUi, 2)
    const profitBps = round(newAmountRounded / oldAmountRounded - 1, 4)

    console.log(
      `Executed ${direction} arbitrage. PreArbBalance: ${
        oldAmountRounded
      } UXD, PostArbBalance: ${
        newAmountRounded
      } UXD`,
    )

    const executeReBalances = async () => {
      await checkAndExecuteUxdReBalance({
        uxdBalanceUi: postArbUxdAmountUi,
        jupiter,
        discordChannel,
      })
      await checkAndExecuteSolReBalance(jupiter)
    }

    await Promise.all([
      updateStatus('ping'),
      sendArbResultMessage({
        channel: discordChannel,
        oldAmount: oldAmountRounded,
        newAmount: newAmountRounded,
        direction,
        profitBps,
      }),
      saveArbResult({
        oldAmount: oldAmountRounded,
        newAmount: newAmountRounded,
        direction,
        profitBps,
      }),
      executeReBalances(),
    ])
  }
}

main()
