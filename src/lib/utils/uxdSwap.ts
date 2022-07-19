// UXD holds 10k mango, taker fees are 0.04%
const MANGO_FEES = 0.04 / 100

const subtractFees = (inputAmount: number, inputDecimals: number) => {
  const fees = inputAmount * MANGO_FEES
  return Number((inputAmount - fees).toFixed(inputDecimals))
}

export type MangoQuoteParams = {
  orderbook: [number, number][]
  inputAmountUi: number
}

/**
 * Simulate SOL to UXD swap (UXD mint)
 * @returns UXD output ui amount
 */
export const simulateMint = ({
  orderbook,
  inputAmountUi,
}: MangoQuoteParams) => {
  let remainingBalance = subtractFees(inputAmountUi, 9)
  let outputAmount = 0

  for (let i = 0; i < orderbook.length; i += 1) {
    if (remainingBalance === 0) {
      break
    }

    const [price, amount] = orderbook[i]
    const fillableAmount = remainingBalance * price

    const realAmount = fillableAmount > amount ? amount : fillableAmount
    const currentCost = realAmount / price

    remainingBalance -= currentCost
    outputAmount += realAmount
  }

  return Number(outputAmount.toFixed(6))
}

/**
 * Simulate UXD to SOL swap (UXD redemption)
 * @returns SOL output ui amount
 */
export const simulateRedeem = ({
  orderbook,
  inputAmountUi,
}: MangoQuoteParams) => {
  let remainingBalance = subtractFees(inputAmountUi, 6)
  let outputAmount = 0

  for (let i = 0; i < orderbook.length; i += 1) {
    if (remainingBalance === 0) {
      break
    }

    const [price, amount] = orderbook[i]
    const fillableAmount = remainingBalance / price
    const realAmount = fillableAmount > amount ? amount : fillableAmount

    const currentCost = realAmount * price

    remainingBalance -= currentCost
    outputAmount += realAmount
  }

  return Number(outputAmount.toFixed(9))
}
