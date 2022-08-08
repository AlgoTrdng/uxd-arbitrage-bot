export const round = (num: number, decimals: number) => (
  Math.round(num * 10 ** decimals) / 10 ** decimals
)
