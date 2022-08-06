import { Decimals } from '../../constants'
import { floor } from '../../helpers/amount'

const MANGO_FEES = 0.04 / 100

const subtractFees = (inputAmountUi: number, decimals: number) => {
  const feesAmount = inputAmountUi * MANGO_FEES
  return floor(inputAmountUi - feesAmount, decimals)
}

export type SimulationParams = {
  orderbook: [number, number][]
  inputAmountUi: number
}

/**
 * UXD to SOl
 * Orderbook = asks
 */
export const simulateRedemption = ({
  orderbook: asks,
  inputAmountUi,
}: SimulationParams) => {
  let remainingBalance = subtractFees(inputAmountUi, Decimals.USD)
  let outputAmount = 0

  for (let i = 0; i < asks.length; i += 1) {
    if (remainingBalance === 0) {
      break
    }

    const [price, amount] = asks[i]
    const fillableAmount = remainingBalance / price
    const realAmount = fillableAmount > amount ? amount : fillableAmount

    const currentCost = realAmount * price

    remainingBalance -= currentCost
    outputAmount += realAmount
  }

  return floor(outputAmount, Decimals.SOL)
}

/**
 * SOL to UXD
 * Orderbook = bids
 */
export const simulateMint = ({
  orderbook: bids,
  inputAmountUi,
}: SimulationParams) => {
  let remainingBalance = subtractFees(inputAmountUi, Decimals.SOL)
  let outputAmount = 0

  for (let i = 0; i < bids.length; i += 1) {
    if (remainingBalance === 0) {
      break
    }

    const [price, amount] = bids[i]
    const fillableAmount = remainingBalance * price

    const realAmount = fillableAmount > amount ? amount : fillableAmount
    const currentCost = realAmount / price

    remainingBalance -= currentCost
    outputAmount += realAmount
  }

  return floor(outputAmount, Decimals.USD)
}
