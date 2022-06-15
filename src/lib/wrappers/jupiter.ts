import { Jupiter, RouteInfo } from '@jup-ag/core'
import { Connection, PublicKey } from '@solana/web3.js'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import config from '../../app.config'
import { mint } from '../../constants'

const { SOL_PRIVATE_KEY, cluster } = config

type SwapResult = {
  txid: string
  inputAmount: number
  outputAmount: number
}

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

  static async init(connection: Connection) {
    const jupiter = await Jupiter.load({
      cluster: `${cluster}-beta` as 'mainnet-beta',
      user: SOL_PRIVATE_KEY,
      connection,
    })

    return new JupiterWrapper(connection, jupiter)
  }
}
