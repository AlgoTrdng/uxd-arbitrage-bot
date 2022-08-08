import { Jupiter } from '@jup-ag/core'

import { config } from '../config'
import { Decimals } from '../constants'
import { floor, toRaw, toUi } from '../helpers/amount'
import {
  fetchBestJupiterRoute,
  Direction,
  Directions,
} from './jupiter'
import { Orderbook, OrderbookSide, OrderbookSideGetter } from './uxd/mango'
import { simulateMint, simulateRedemption } from './uxd/simulateSwap'

const MA_LENGTH = 20

class PriceDiffMAWatcher {
  private priceDiffs: number[] = []

  addPriceDiff(val: number) {
    if (val === -100) {
      return
    }

    if (this.priceDiffs.length === 20) {
      this.priceDiffs = [...this.priceDiffs.slice(1), val]
      return
    }

    this.priceDiffs.push(val)
  }

  get ma() {
    if (this.priceDiffs.length !== 20) {
      return null
    }

    return this.priceDiffs.reduce((total, current) => total + current, 0) / MA_LENGTH
  }
}

export const initPriceDiffsMAs = () => {
  const priceDiffsLevelsIncrement = 20
  const priceDiffsMAs = Array.from(
    { length: config.maxUxdAmountUi / priceDiffsLevelsIncrement },
    (_, i) => {
      const inputAmount = (i + 1) * priceDiffsLevelsIncrement
      return {
        inputAmount,
        redemption: new PriceDiffMAWatcher(),
        mint: new PriceDiffMAWatcher(),
      } as const
    },
  )

  return priceDiffsMAs
}

const calculateDifference = (input: number, output: number) => (
  floor((output / input - 1) * 100, 2)
)

type GetPriceDiffParams = {
  jupiter: Jupiter
  inputAmountUi: number
  orderbook: Orderbook
  forceFetch?: boolean
}

/**
 * Simulate redemption arbitrage
 * UXD to SOL on Mango
 * SOL to UXD on Jupiter
 */
export const getRedemptionPriceDifference = async ({
  jupiter,
  inputAmountUi,
  orderbook,
  forceFetch,
}: GetPriceDiffParams) => {
  const redeemOutputUi = simulateRedemption({ orderbook, inputAmountUi })
  try {
    const bestRoute = await fetchBestJupiterRoute({
      jupiter,
      forceFetch,
      amountRaw: toRaw(redeemOutputUi, Decimals.SOL),
      direction: 'redemption',
    })
    return calculateDifference(
      inputAmountUi,
      toUi(Number(bestRoute.outAmount.toString()), Decimals.USD),
    )
  } catch (error) {
    return -100
  }
}

/**
 * Simulate mint arbitrage
 * UXD to SOL on Jupiter
 * SOL to UXD on Mango
 */
const getMintPriceDifference = async ({
  jupiter,
  inputAmountUi,
  orderbook,
  forceFetch,
}: GetPriceDiffParams) => {
  try {
    const { outAmount } = await fetchBestJupiterRoute({
      jupiter,
      forceFetch,
      amountRaw: toRaw(inputAmountUi, Decimals.USD),
      direction: 'mint',
    })
    const mintOutputUi = simulateMint({
      orderbook,
      inputAmountUi: toUi(Number(outAmount.toString()), Decimals.SOL),
    })
    return calculateDifference(inputAmountUi, mintOutputUi)
  } catch (error) {
    return -100
  }
}

export type UpdatePriceDiffsAndFindArb = {
  getOrderbookSide: OrderbookSideGetter
  jupiter: Jupiter
  priceDiffsMAs: ReturnType<typeof initPriceDiffsMAs>
}

export const updatePriceDiffsAndFindArb = async ({
  getOrderbookSide,
  jupiter,
  priceDiffsMAs,
}: UpdatePriceDiffsAndFindArb) => {
  const execute = async (
    i: number,
    forceFetch: boolean,
  ) => {
    // Update price diffs
    const { inputAmount: inputAmountUi } = priceDiffsMAs[i]
    const redemptionPriceDiff = await getRedemptionPriceDifference({
      orderbook: getOrderbookSide('asks'),
      jupiter,
      inputAmountUi,
      forceFetch,
    })
    const mintPriceDiff = await getMintPriceDifference({
      orderbook: getOrderbookSide('bids'),
      jupiter,
      inputAmountUi,
    })

    priceDiffsMAs[i].redemption.addPriceDiff(redemptionPriceDiff)
    priceDiffsMAs[i].mint.addPriceDiff(mintPriceDiff)

    // Check if arb is possible
    const isHighPriceDiff = mintPriceDiff > config.minPriceDiff
      || redemptionPriceDiff > config.minPriceDiff
    if (!isHighPriceDiff) {
      return null
    }

    const direction = redemptionPriceDiff > mintPriceDiff ? Directions.REDEMPTION : Directions.MINT
    const priceDiffMA = priceDiffsMAs[i][direction].ma
    if (!priceDiffMA || priceDiffMA < config.minMaPriceDiff) {
      return null
    }

    return {
      arbOpportunity: {
        inputAmountUi,
        direction,
      },
      priceDiffs: {
        mint: mintPriceDiff,
        redemption: redemptionPriceDiff,
        ma: priceDiffMA,
      },
    }
  }

  let highestArbConfig: Awaited<ReturnType<typeof execute>> = null
  for (let i = 0; i < priceDiffsMAs.length; i += 1) {
    const arbConfig = await execute(i, i === 0)
    if (arbConfig) {
      highestArbConfig = arbConfig
    }
  }

  return highestArbConfig
}
