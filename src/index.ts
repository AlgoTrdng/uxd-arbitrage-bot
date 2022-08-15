import { setTimeout } from 'timers/promises'

import {
  getMintPriceDifference,
  getRedemptionPriceDifference,
  initPriceDiffsMAs,
  updatePriceDiffsAndFindArb,
} from './core/priceDiffs'
import { Directions, executeJupiterSwap, initJupiter } from './core/jupiter'
import { subscribeToMangoAsks } from './core/uxd/mango'
import { toRaw, toUi, floor } from './helpers/amount'
import { Decimals } from './constants'
import { getUxdBalanceRaw } from './helpers/getBalance'
import { config } from './config'
import {
  buildMintRawTransaction,
  buildRedeemRawTransaction,
  executeUxdTransaction,
  initUxdClient,
} from './core/uxd'
import { checkAndExecuteSolReBalance, checkAndExecuteUxdReBalance } from './core/reBalance'
import { initDiscord, setActivity } from './logging/discord'
import { updateStatus } from './logging/status'
import { logArbEnd, logArbStart } from './logging/helpers'
import { ParsedTransactionMeta } from './helpers/sendTransaction'

type ArbResultSuccess = {
  success: true
  postArbUxdBalanceRaw: number
}

type ArbResultAborted = {
  success: false
}

const main = async () => {
  const { channel: discordChannel, client: discordClient } = await initDiscord()

  const jupiter = await initJupiter()
  const uxdClient = await initUxdClient()
  const getOrderbookSide = await subscribeToMangoAsks()

  const priceDiffs = initPriceDiffsMAs()

  let uxdBalanceRaw = await getUxdBalanceRaw()
  while (true) {
    await setTimeout(10_000)
    updateStatus('ping')

    // Check pride differences and get arb config
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

    const uxdBalanceUi = toUi(uxdBalanceRaw, Decimals.USD)
    const { inputAmountUi: maxInputAmountUi, direction } = arbConfig.arbOpportunity
    const inputAmountUi = maxInputAmountUi > uxdBalanceUi
      ? uxdBalanceUi - 1
      : maxInputAmountUi

    await logArbStart({
      suggestedInputAmount: maxInputAmountUi,
      realInputAmount: inputAmountUi,
      discordClient,
      direction,
    })

    const arbResult = await (async (): Promise<ArbResultSuccess | ArbResultAborted> => {
      switch (direction) {
        case Directions.MINT: {
          const swapResult = await executeJupiterSwap({
            amountRaw: toRaw(inputAmountUi, Decimals.USD),
            jupiter,
            direction,
          }, async () => {
            const priceDiff = await getMintPriceDifference({
              orderbook: getOrderbookSide('bids'),
              forceFetch: true,
              jupiter,
              inputAmountUi,
            })
            console.log({ mintFailPriceDiff: priceDiff })
            return config.minPriceDiff > priceDiff
          })

          if (!swapResult) {
            return {
              success: false,
            }
          }

          const swapOutputAmountUi = toUi(swapResult.solSwapAmountRaw, Decimals.SOL)
          const mintInputAmountUi = floor(swapOutputAmountUi, 2)
          const remainingAmountUi = swapOutputAmountUi - mintInputAmountUi

          const mintResult = await executeUxdTransaction(() => (
            buildMintRawTransaction(mintInputAmountUi, uxdClient)
          ))

          let remainingSwapResult: ParsedTransactionMeta | null = null
          if (remainingAmountUi > 0) {
            remainingSwapResult = await executeJupiterSwap({
              direction: Directions.REDEMPTION,
              amountRaw: toRaw(remainingAmountUi, Decimals.SOL),
              jupiter,
            })
          }

          // eslint-disable-next-line max-len
          const postArbUxdAmountRaw = remainingSwapResult?.postUxdAmountRaw || mintResult.postUxdAmountRaw
          return {
            success: true,
            postArbUxdBalanceRaw: postArbUxdAmountRaw,
          }
        }
        case Directions.REDEMPTION: {
          const redeemResult = await executeUxdTransaction(() => (
            buildRedeemRawTransaction(inputAmountUi, uxdClient)
          ), async () => {
            const priceDiff = await getRedemptionPriceDifference({
              orderbook: getOrderbookSide('asks'),
              forceFetch: true,
              jupiter,
              inputAmountUi,
            })
            console.log({ redeemFailPriceDiff: priceDiff })
            return config.minPriceDiff > priceDiff
          })

          if (!redeemResult) {
            return {
              success: false,
            }
          }

          const swapResult = await executeJupiterSwap({
            amountRaw: redeemResult.solSwapAmountRaw,
            jupiter,
            direction,
          })

          return {
            success: true,
            postArbUxdBalanceRaw: swapResult.postUxdAmountRaw,
          }
        }
        default: throw Error(`Unknown arb direction: ${direction}`)
      }
    })()

    setActivity(discordClient)

    if (!arbResult.success) {
      continue
    }
    uxdBalanceRaw = arbResult.postArbUxdBalanceRaw
    // ---------------
    // Log arb results
    const { postArbUxdBalanceRaw } = arbResult
    const postArbUxdBalanceUi = toUi(postArbUxdBalanceRaw, Decimals.USD)

    const executeReBalances = async () => {
      await checkAndExecuteUxdReBalance({
        uxdBalanceUi: postArbUxdBalanceUi,
        jupiter,
        discordChannel,
      })
      await checkAndExecuteSolReBalance(jupiter)
    }

    await Promise.all([
      logArbEnd({
        preArbUxdBalanceUi: uxdBalanceUi,
        postArbUxdBalanceUi,
        discordChannel,
        direction,
      }),
      // TODO: Update uxd balance after rebalance
      executeReBalances(),
    ])
  }
}

main()
