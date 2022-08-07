import { Jupiter } from '@jup-ag/core'

import { config, MIN_MA_PRICE_DIFF, MIN_PRICE_DIFF } from '../config'
import { Decimals } from '../constants'
import { floor, toRaw, toUi } from '../helpers/amount'
import {
  fetchBestJupiterRoute,
  Direction,
  Directions,
} from './jupiter'
import { Orderbook, OrderbookSideGetter } from './uxd/mango'
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
    { length: config.MAX_UXD_AMOUNT_UI / priceDiffsLevelsIncrement },
    (_, i) => {
      const inputAmount = (i + 1) * priceDiffsLevelsIncrement
      return {
        inputAmount,
        redemption: new PriceDiffMAWatcher(),
        mint: new PriceDiffMAWatcher(),
      } as const
    },
  )

  // Reverse so we get levels from highest to lower and can break on the highets possible arb
  return priceDiffsMAs.reverse()
}

const calculateDifference = (input: number, output: number) => (
  floor((output / input - 1) * 100, 2)
)

type GetPriceDiffParams = {
  jupiter: Jupiter
  inputAmountUi: number
  orderbook: Orderbook
  forceFetch?: true
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

const isArbPossible = (
  mintPriceDiff: number,
  redemptionPriceDiff: number,
  priceDiffsMA: ReturnType<typeof initPriceDiffsMAs>[number],
) => {
  const isHighPriceDiff = mintPriceDiff > MIN_PRICE_DIFF || redemptionPriceDiff > MIN_PRICE_DIFF
  if (!isHighPriceDiff) {
    return null
  }
  const direction = redemptionPriceDiff > mintPriceDiff ? Directions.REDEMPTION : Directions.MINT
  const priceDiffMA = priceDiffsMA[direction].ma
  if (!priceDiffMA || priceDiffMA < MIN_MA_PRICE_DIFF) {
    return null
  }
  return direction
}

export type UpdatePriceDiffsAndFindArb = {
  getOrderbookSide: OrderbookSideGetter
  jupiter: Jupiter
  priceDiffsMAs: ReturnType<typeof initPriceDiffsMAs>
}

type ArbOpportunity = {
  inputAmountUi: number
  direction: Direction
}

export const updatePriceDiffsAndFindArb = async ({
  getOrderbookSide,
  jupiter,
  priceDiffsMAs,
}: UpdatePriceDiffsAndFindArb) => {
  // Fetch Jupiter cache update
  let highestArbAmount: ArbOpportunity | null = await (async () => {
    const { inputAmount } = priceDiffsMAs[0]
    const redemptionPriceDiff = await getRedemptionPriceDifference({
      jupiter,
      inputAmountUi: inputAmount,
      orderbook: getOrderbookSide('asks'),
      forceFetch: true,
    })
    const mintPriceDiff = await getMintPriceDifference({
      jupiter,
      inputAmountUi: inputAmount,
      orderbook: getOrderbookSide('bids'),
    })

    priceDiffsMAs[0].redemption.addPriceDiff(redemptionPriceDiff)
    priceDiffsMAs[0].mint.addPriceDiff(mintPriceDiff)

    const arbDirection = isArbPossible(
      mintPriceDiff,
      redemptionPriceDiff,
      priceDiffsMAs[0],
    )

    if (arbDirection) {
      return {
        inputAmountUi: inputAmount,
        direction: arbDirection,
      }
    }

    return null
  })()

  for (let i = 1; i < priceDiffsMAs.length; i += 1) {
    const { inputAmount } = priceDiffsMAs[i]
    const redemptionPriceDiff = await getRedemptionPriceDifference({
      jupiter,
      inputAmountUi: inputAmount,
      orderbook: getOrderbookSide('asks'),
    })
    const mintPriceDiff = await getMintPriceDifference({
      jupiter,
      inputAmountUi: inputAmount,
      orderbook: getOrderbookSide('bids'),
    })

    priceDiffsMAs[i].redemption.addPriceDiff(redemptionPriceDiff)
    priceDiffsMAs[i].mint.addPriceDiff(mintPriceDiff)

    const arbDirection = isArbPossible(
      mintPriceDiff,
      redemptionPriceDiff,
      priceDiffsMAs[i],
    )

    if (arbDirection) {
      highestArbAmount = {
        inputAmountUi: inputAmount,
        direction: arbDirection,
      }
    }
  }

  return highestArbAmount
}
