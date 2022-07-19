import { Jupiter, RouteInfo } from '@jup-ag/core'
import { Connection, PublicKey } from '@solana/web3.js'

import config from '../../app.config'

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

type FetchBestRouteInfoParams = {
  inputMint: PublicKey
  outputMint: PublicKey
  inputChainAmount: number
  slippage?: number
  forceFetch?: boolean
}

export class JupiterWrapper {
  connection: Connection
  jupiter: Jupiter

  constructor(connection: Connection, jupiter: Jupiter) {
    this.connection = connection
    this.jupiter = jupiter
  }

  async fetchRouteInfoAndSwap({
    inputMint,
    outputMint,
    swapChainAmount,
    slippagePercentage,
  }: SwapConfig) {
    const slippage = slippagePercentage || 0.5

    const routeInfo = await this.fetchBestRouteInfo({
      inputChainAmount: swapChainAmount,
      forceFetch: true,
      inputMint,
      outputMint,
      slippage,
    })
    const swapResult = await this.swap(routeInfo)
    return swapResult
  }

  /**
   * @param inputChainAmount Chain amount of input token
   */
  async fetchBestRouteInfo({
    inputChainAmount,
    inputMint,
    outputMint,
    slippage,
    forceFetch,
  }: FetchBestRouteInfoParams) {
    if (!this.jupiter) {
      throw Error('Jupiter is not defined')
    }

    const _slippage = slippage || 0.5

    const routes = await this.jupiter.computeRoutes({
      slippage: _slippage,
      inputAmount: inputChainAmount,
      forceFetch,
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

  /**
   * @returns Swap output ui amount
   */
  async fetchOutput({
    inputUiAmount,
    inputMintAddress,
    outputMintAddress,
    inputDecimals,
    outputDecimals,
  }: FetchPriceConfig) {
    try {
      const { outAmount } = await this.fetchBestRouteInfo({
        inputMint: inputMintAddress,
        outputMint: outputMintAddress,
        inputChainAmount: inputUiAmount * (10 ** inputDecimals),
      })
      return outAmount / (10 ** outputDecimals)
    } catch (error) {
      console.log(error)
      return null
    }
  }

  static async init(connection: Connection) {
    const jupiter = await Jupiter.load({
      cluster: `${cluster}-beta` as 'mainnet-beta',
      user: SOL_PRIVATE_KEY,
      routeCacheDuration: 10_000,
      connection,
    })

    return new JupiterWrapper(connection, jupiter)
  }
}
