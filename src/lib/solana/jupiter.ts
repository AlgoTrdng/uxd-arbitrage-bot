import { Jupiter, RouteInfo } from '@jup-ag/core'
import { Connection, PublicKey } from '@solana/web3.js'

import config from '../../app.config'
import { force } from '../utils/force'

const { SOL_PRIVATE_KEY, cluster } = config

/**
 * Config for Jupiter swap
 *
 * default slippage - 0.5%
 */
type SwapConfig = {
  inputMint: PublicKey,
  outputMint: PublicKey,
  swapChainAmount: number,
  slippagePercentage?: number
}

type SwapResultSuccess = {
  txid: string
  inputAmount: number
  outputAmount: number
}

type FetchPriceConfig = {
  inputUiAmount: number
  inputMintAddress: PublicKey
  inputDecimals: number
  outputMintAddress: PublicKey
  outputDecimals: number
}

export class JupiterWrapper {
  connection: Connection
  jupiter: Jupiter

  constructor(connection: Connection, jupiter: Jupiter) {
    this.connection = connection
    this.jupiter = jupiter
  }

  async fetchRouteInfoAndSwap(swapConfig: SwapConfig) {
    const slippage = swapConfig.slippagePercentage || 0.5
    const { inputMint, outputMint, swapChainAmount } = swapConfig

    const routeInfo = await this.fetchBestRouteInfo(
      inputMint,
      outputMint,
      swapChainAmount,
      slippage,
    )
    const swapResult = await force(
      () => this.swap(routeInfo),
      { wait: 200 },
    )
    return swapResult
  }

  /**
   * @param inputChainAmount Chain amount of input token
   */
  async fetchBestRouteInfo(inputMint: PublicKey, outputMint: PublicKey, inputChainAmount: number, slippage = 0.5) {
    const routes = await this.jupiter!.computeRoutes({
      forceFetch: true,
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
      return swapResult as SwapResultSuccess
    }
    return null
  }

  async fetchPrice(fetchPriceConfig: FetchPriceConfig) {
    const {
      inputUiAmount,
      inputMintAddress,
      outputMintAddress,
      inputDecimals,
      outputDecimals,
    } = fetchPriceConfig

    try {
      const bestRouteInfo = await this.fetchBestRouteInfo(
        inputMintAddress,
        outputMintAddress,
        inputUiAmount * (10 ** inputDecimals),
      )
      const inUiAmount = bestRouteInfo.inAmount / (10 ** inputDecimals)
      const outUiAmount = bestRouteInfo.outAmount / (10 ** outputDecimals)
      const price = outUiAmount / inUiAmount
      return price
    } catch (error) {
      console.log(error)
      return null
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
