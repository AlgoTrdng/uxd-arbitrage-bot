import { Jupiter } from '@jup-ag/core'
import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import config from '../../app.config'
import { mint } from '../constants'

const { SOL_PRIVATE_KEY, CLUSTER } = config

export class JupiterWatcher {
  connection: Connection
  jupiter: Jupiter

  constructor(connection: Connection, jupiter: Jupiter) {
    this.connection = connection
    this.jupiter = jupiter
  }

  static async init(connection: Connection) {
    const jupiter = await Jupiter.load({
      cluster: `${CLUSTER}-beta` as 'mainnet-beta',
      user: SOL_PRIVATE_KEY,
      connection,
    })

    return new JupiterWatcher(connection, jupiter)
  }

  async getSolToUxdPrice(inputSolAmount: number) {
    const routes = await this.jupiter!.computeRoutes({
      inputMint: mint.SOL,
      outputMint: mint.UXD,
      slippage: 0.5,
      inputAmount: inputSolAmount * (10 ** SOL_DECIMALS),
    })
    const [bestRouteInfo] = routes.routesInfos

    const solAmount = bestRouteInfo.inAmount / (10 ** SOL_DECIMALS)
    const uxdAmount = bestRouteInfo.outAmount / (10 ** UXD_DECIMALS)
    const solPrice = uxdAmount / solAmount
    return solPrice
  }
}
