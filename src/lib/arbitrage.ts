import { Jupiter } from '@jup-ag/core'
import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js'
import {
  Controller,
  Mango,
  MangoDepository,
  SOL_DECIMALS,
  UXDClient,
  UXD_DECIMALS,
} from '@uxd-protocol/uxd-client'

import config from '../app.config'
import { initUxd, UxdConfig } from './utils/initUxd'
import { mint } from '../constants'
import { logger } from './utils/logger'

type _SwapResult = {
  txid: string
  inputAmount: number
  outputAmount: number
}

type ArbitrageConfig = {
  connection: Connection
  jupiter: Jupiter
}

export class Arbitrage {
  connection: Connection
  jupiter: Jupiter
  uxdClient: UXDClient
  uxdMango: Mango
  uxdDepository: MangoDepository
  uxdController: Controller

  static async init({ connection, jupiter }: ArbitrageConfig) {
    const uxdConfig = await initUxd(connection)
    return new Arbitrage(connection, jupiter, uxdConfig)
  }

  static getSafeSolAmount(totalAmount: number) {
    return totalAmount - 0.1 * (10 ** SOL_DECIMALS)
  }

  constructor(connection: Connection, jupiter: Jupiter, uxdConfig: UxdConfig) {
    this.connection = connection
    this.jupiter = jupiter

    const {
      controller, uxdMango, depository, client,
    } = uxdConfig
    this.uxdClient = client
    this.uxdMango = uxdMango
    this.uxdDepository = depository
    this.uxdController = controller
  }

  /**
   * @description Jupiter generic swap wrapper, retries to swap until tx id is returned
   */
  async swap(inputMint: PublicKey, outputMint: PublicKey, inputAmount: number): Promise<_SwapResult | null> {
    const routes = await this.jupiter.computeRoutes({
      inputMint,
      outputMint,
      inputAmount,
      slippage: 0.5,
    })
    const { execute } = await this.jupiter.exchange({ routeInfo: routes.routesInfos[0] })
    const swapResult = await execute()
    // @ts-ignore
    if (swapResult?.txid) {
      return swapResult as _SwapResult
    }
    return null
  }

  /**
   * @description Swaps SOL for UXD on Jupiter
   */
  async swapSolForUxd(inputAmount: number) {
    logger('SWAP', 'Swapping SOL to UXD')
    return this.swap(mint.SOL, mint.UXD, inputAmount)
  }

  /**
   * @description Create redeem UXD transaction
   */
  createRedeemTransaction(uxdBalance: number) {
    const transaction = new Transaction()
    const redeemIx = this.uxdClient.createRedeemFromMangoDepositoryInstruction(
      uxdBalance / (10 ** UXD_DECIMALS),
      5,
      this.uxdController,
      this.uxdDepository,
      this.uxdMango,
      config.SOL_PUBLIC_KEY,
      {},
    )
    transaction.add(redeemIx)
    return transaction
  }

  /**
   * @description Send and confirm redeem wrapper
   */
  async sendAndConfirmRedeem(transaction: Transaction) {
    try {
      await sendAndConfirmTransaction(this.connection, transaction, [config.SOL_PRIVATE_KEY])
      return true
    } catch (error) {
      return false
    }
  }
}
