/**
 * @description Calculates chain amount from provided token UI amount
 */
export const getChainAmount = (uiAmount: number, decimals: number) => Math.floor(uiAmount * (10 ** decimals))

/**
  * @description Calculates UI amount from provided token chain amount
  */
export const getUiAmount = (chainAmount: number, decimals: number) => {
  const uiAmount = chainAmount / (10 ** decimals)
  return Number(uiAmount.toFixed(decimals))
}
