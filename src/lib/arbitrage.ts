import { Jupiter } from '@jup-ag/core'
import {
  Connection, PublicKey, sendAndConfirmTransaction, Transaction,
} from '@solana/web3.js'
import {
  Controller, Mango, MangoDepository, SOL_DECIMALS, UXDClient, UXD_DECIMALS,
} from '@uxd-protocol/uxd-client'

import config from '../app.config'
import { mint } from './constants'
import User from './user'
import { logger } from './utils/logger'
import { wait } from './utils/wait'

const getSafeSolBalance = (solBalance: number) => (
  // Always leave 0.1 SOL in wallet
  solBalance - 0.1 * (10 ** SOL_DECIMALS)
)

type _SwapResult = {
  txid: string
  inputAmount: number
  outputAmount: number
}

type UxdConfig = {
  controller: Controller
  uxdMango: Mango
  depository: MangoDepository
  client: UXDClient
}

class Arbitrage {
  connection: Connection
  jupiter: Jupiter
  uxdClient: UXDClient
  uxdMango: Mango
  uxdDepository: MangoDepository
  uxdController: Controller
  user: User

  constructor(connection: Connection, jupiter: Jupiter, user: User, uxdConfig: UxdConfig) {
    this.connection = connection
    this.jupiter = jupiter
    this.user = user

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
  private async swap(inputMint: PublicKey, outputMint: PublicKey, inputAmount: number): Promise<_SwapResult> {
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
    logger('SWAP', 'Could not swap. Retrying...')
    return this.swap(inputMint, outputMint, inputAmount)
  }

  /**
   * @description Fetches SOL balances, swaps SOL for UXD on Jupiter
   */
  async swapSolForUxd() {
    await this.user.fetchLamportsBalances()

    // Swapping SOL for UXD happens always after REDEMPTION
    // we do not fetch SOL balance after swap, however its always going to be less than 0.11 SOL (check getSafeSolBalance function)
    // so if fetched SOL balance is not yet updated to match balance after REDEMPTION, refetch
    while (this.user.balances.SOL < 110_000_000) {
      // eslint-disable-next-line no-await-in-loop
      await this.user.fetchLamportsBalances()
    }

    const safeSolBalance = getSafeSolBalance(this.user.balances.SOL)

    const result = await this.swap(mint.SOL, mint.UXD, safeSolBalance)
    return result
  }

  /**
   * @description Create redeem UXD transaction
   */
  private createRedeemTransaction() {
    const transaction = new Transaction()
    const redeemIx = this.uxdClient.createRedeemFromMangoDepositoryInstruction(
      this.user.balances.UXD / (10 ** UXD_DECIMALS),
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
   * @description Send and confirm redeem transaction wrapper, retries to send tx until success or balances change
   */
  private async sendAndConfirmRedeem(transaction: Transaction) {
    try {
      await sendAndConfirmTransaction(this.connection, transaction, [config.SOL_PRIVATE_KEY])
    } catch (error) {
      await wait(500)
      await this.user.fetchSplBalance('UXD')
      if (this.user.balances.UXD < this.user.oldBalances.UXD) {
        return
      }
      logger('REDEMPTION', 'Could not redeem. Retrying...')
      await this.sendAndConfirmRedeem(transaction)
    }
  }

  /**
   * @description Fetches UXD balance, redeems UXD for SOL
   */
  async redeemUxd() {
    await this.user.fetchSplBalance('UXD')
    const redeemUxdAmount = this.user.balances.UXD

    const tx = this.createRedeemTransaction()
    await this.sendAndConfirmRedeem(tx)

    return redeemUxdAmount
  }
}

export default Arbitrage
