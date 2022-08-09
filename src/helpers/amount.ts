export const floor = (amount: number, decimals: number) => (
  Math.floor(amount * 10 ** decimals) / 10 ** decimals
)

export const round = (num: number, decimals: number) => (
  Math.round(num * 10 ** decimals) / 10 ** decimals
)

export const toUi = (rawAmount: number, decimals: number) => (
  floor(rawAmount / 10 ** decimals, decimals)
)

export const toRaw = (uiAmount: number, decimals: number) => (
  Math.floor(uiAmount * 10 ** decimals)
)
