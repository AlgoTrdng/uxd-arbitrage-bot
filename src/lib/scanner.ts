import { MangoGroup } from '@blockworks-foundation/mango-client'
import { Jupiter } from '@jup-ag/core'
import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { mint } from './constants'
import { initMangoGroup } from './utils/initMango'

const fetchJupiterSolToUsdQuote = async (jupiter: Jupiter) => {
  const routes = await jupiter.computeRoutes({
    inputMint: mint.SOL,
    outputMint: mint.UXD,
    inputAmount: 11 * (10 ** SOL_DECIMALS),
    slippage: 0.2,
  })
  const [bestRouteInfo] = routes.routesInfos

  const solAmount = bestRouteInfo.inAmount / (10 ** SOL_DECIMALS)
  const uxdAmount = bestRouteInfo.outAmount / (10 ** UXD_DECIMALS)
  const solPrice = uxdAmount / solAmount
  return solPrice
}

const fetchMangoIndex = async (connection: Connection, mangoGroup: MangoGroup) => {
  const mangoCache = await mangoGroup.loadCache(connection)
  const mangoSolPrice = mangoGroup.getPrice(3, mangoCache)
  return mangoSolPrice.toNumber()
}

class Watcher {
  connection: Connection
  jupiter: Jupiter
  mangoGroup: MangoGroup | null = null

  constructor(connection: Connection, jupiter: Jupiter) {
    this.connection = connection
    this.jupiter = jupiter
  }

  async init() {
    const mangoGroup = await initMangoGroup(this.connection)
    this.mangoGroup = mangoGroup
  }

  async fetchPrices() {
    if (!this.jupiter || !this.mangoGroup) {
      throw Error('Error: Did not init Scanner')
    }

    const [jupiterPrice, mangoPrice] = await Promise.all([
      await fetchJupiterSolToUsdQuote(this.jupiter),
      await fetchMangoIndex(this.connection, this.mangoGroup),
    ])

    return {
      jupiterPrice,
      mangoPrice,
    }
  }

  async getPriceDiff() {
    const { jupiterPrice, mangoPrice } = await this.fetchPrices()
    const priceDiff = jupiterPrice / mangoPrice - 1
    const priceDiffPercentage = (priceDiff * 100).toFixed(2)

    return +priceDiffPercentage
  }
}

export default Watcher
