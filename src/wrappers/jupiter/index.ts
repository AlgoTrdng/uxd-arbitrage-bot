import { Jupiter, RouteInfo } from '@jup-ag/core'
import { Connection, PublicKey } from '@solana/web3.js'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { SwapResult } from './types'
import config from '../../app.config'
import { mint } from '../../constants'

const { SOL_PRIVATE_KEY, cluster } = config

export class JupiterWrapper {
  connection: Connection
  jupiter: Jupiter

  constructor(connection: Connection, jupiter: Jupiter) {
    this.connection = connection
    this.jupiter = jupiter
  }

  /**
   * @param inputChainAmount Chain amount of input token
   */
  async fetchBestRouteInfo(inputMint: PublicKey, outputMint: PublicKey, inputChainAmount: number, slippage = 0.5) {
    const routes = await this.jupiter!.computeRoutes({
      slippage,
      inputAmount: inputChainAmount,
      inputMint,
      outputMint,
    })
    const [bestRouteInfo] = routes.routesInfos
    return bestRouteInfo
  }

  /**
   * @returns null if swap fails
   */
  async swap(route: RouteInfo) {
    const { execute } = await this.jupiter.exchange({ routeInfo: route })
    const swapResult = await execute()
    // @ts-ignore
    if (swapResult?.txid) {
      return swapResult as SwapResult
    }
    return null
  }

  async getSolToUxdPrice(solUiAmount: number): Promise<number> {
    try {
      const bestRouteInfo = await this.fetchBestRouteInfo(mint.SOL, mint.UXD, solUiAmount * (10 ** SOL_DECIMALS))

      const solAmount = bestRouteInfo.inAmount / (10 ** SOL_DECIMALS)
      const uxdAmount = bestRouteInfo.outAmount / (10 ** UXD_DECIMALS)
      const solPrice = uxdAmount / solAmount
      return solPrice
    } catch (error) {
      console.log(error)
      return this.getSolToUxdPrice(solUiAmount)
    }
  }

  static async init(connection: Connection) {
    const jupiter = await Jupiter.load({
      cluster: `${cluster}-beta` as 'mainnet-beta',
      user: SOL_PRIVATE_KEY,
      connection,
    })

    return new JupiterWrapper(connection, jupiter)
  }
}
