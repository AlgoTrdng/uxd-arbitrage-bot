import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS } from '@uxd-protocol/uxd-client'

import { Arbitrage } from './arbitrage'
import { JupiterWatcher } from './utils/jupiterWatcher'
import { MangoWatcher } from './utils/mangoWatcher'
import { Wallet } from './wallet'
import { logger } from './utils/logger'
import { Discord } from './discord'
import { wait } from './utils/wait'
import config from '../app.config'

type BotConfig = {
  connection: Connection
  wallet: Wallet
  arbitrage: Arbitrage
  jupiterWatcher: JupiterWatcher
  mangoWatcher: MangoWatcher
  discord: Discord
}

type ArbStatus = {
  executing: boolean
  startAmount: number
}

const MIN_LAMPORTS_BALANCE = 0.11 * 10 ** SOL_DECIMALS

export class Bot {
  connection: Connection
  wallet: Wallet
  arbitrage: Arbitrage
  jupiterWatcher: JupiterWatcher
  mangoWatcher: MangoWatcher
  discord: Discord

  arbStatus: ArbStatus = { executing: false, startAmount: 0 }
  /**
   * @description Price difference between Mango markets SOL-PERP and Jupiter SOL to UXD, gets updated every 30 seconds,
   * on update if price difference is high enough, executes arbitrage
   */
  priceDiff = new Proxy<{ value: null | number }>({
    value: null,
  }, {
    set: (target, prop, value) => {
      logger('STATUS', `Price diff ${value}%`)
      if (value > config.MIN_ARB_PERCENTAGE && !this.arbStatus.executing) {
        this.arbStatus.executing = true
        this.executeArbitrage()
      }

      target[prop as 'value'] = value
      return true
    },
  })

  constructor(botConfig: BotConfig) {
    const {
      connection,
      wallet,
      arbitrage,
      jupiterWatcher,
      mangoWatcher,
      discord,
    } = botConfig

    this.connection = connection
    this.wallet = wallet
    this.arbitrage = arbitrage
    this.jupiterWatcher = jupiterWatcher
    this.mangoWatcher = mangoWatcher
    this.discord = discord
  }

  /**
   * @description Start arbitrage, initialize websocket connections
   */
  async startWatchingForArbitrage() {
    this.watchAccountChange()
    this.mangoWatcher.watchSolPerpAsks()

    const watchJupiter = async () => {
      if (this.mangoWatcher.asks.length && this.wallet.uxdBalance) {
        const priceDiff = await this.getPriceDiff()
        this.priceDiff.value = priceDiff
      }

      setTimeout(watchJupiter, 1000 * 30)
    }

    // Wait for all connections to establish
    setTimeout(watchJupiter, 1000 * 10)
  }

  /**
   * @description Execute first step of arbitrage, redeem UXD for SOL
   */
  async executeArbitrage() {
    logger('STATUS', 'Executing arbitrage')
    const successfulRedemption = await this.redeemUxd()

    if (!successfulRedemption) {
      this.arbStatus.executing = false
      return
    }

    // Swap SOL for UXD
    await this.swapSolForUxd()
    await this.wallet.fetchUxdBalance()

    this.sendPostArbMessage(true)

    this.arbStatus = {
      executing: false,
      startAmount: 0,
    }
  }

  /**
   * @description Initialize account change listener, swaps SOL for UXD when arbitrage fails due to low price diff but transaction goes through
   */
  watchAccountChange() {
    this.connection.onAccountChange(config.SOL_PUBLIC_KEY, async (accountInfo) => {
      const { lamports } = accountInfo

      if (lamports > MIN_LAMPORTS_BALANCE && !this.arbStatus.executing) {
        await this.swapSolForUxd()
        await this.wallet.fetchUxdBalance()
        this.sendPostArbMessage(false)
        this.arbStatus.startAmount = 0
      }
    })
  }

  /**
   * @description Returns false if priceDiff is lower than MIN_ARB_PERCENTAGE
   */
  async redeemUxd() {
    const { arbitrage, wallet } = this

    await wallet.fetchUxdBalance()
    const startingUxdBalance = Wallet.getUiBalance(wallet.uxdBalance, 'UXD')

    // if starting balance is lower than 10, swap back to UXD from previous failed redemption has not been confirmed yet
    if (startingUxdBalance < 10) {
      logger('REDEMPTION', 'Uxd balance is too low, swap back to UXD from previous failed redemption has not been confirmed yet')
      return false
    }

    this.arbStatus.startAmount = startingUxdBalance

    const redeemTx = arbitrage.createRedeemTransaction(wallet.uxdBalance)
    let success = await arbitrage.sendAndConfirmRedeem(redeemTx)

    while (!success) {
      await wait(500)

      const preRedemptionLamportsBalance = await wallet.fetchLamportsBalance()
      // If new uxd balance is lower than old uxd balance, redemption was successful
      if (wallet.lamportsBalance > preRedemptionLamportsBalance) {
        return true
      }

      logger('REDEMPTION', 'Redemption failed, retrying...')

      const priceDiff = await this.getPriceDiff()
      if (priceDiff < config.MIN_ARB_PERCENTAGE) {
        logger('REDEMPTION', 'Ending redemption, price diff is too low')
        return false
      }

      success = await arbitrage.sendAndConfirmRedeem(redeemTx)
    }

    return true
  }

  /**
   * @description Swap SOL for UXD, repeat swap until it is successful
   */
  async swapSolForUxd() {
    const { arbitrage, wallet } = this

    await wallet.fetchLamportsBalance()

    // If SOL balance is less 0.11 (minimum account SOL balance), refetch
    while (wallet.lamportsBalance < MIN_LAMPORTS_BALANCE) {
      await wait(500)
      await wallet.fetchLamportsBalance()
    }

    const safeSolAmount = Arbitrage.getSafeSolAmount(wallet.lamportsBalance)
    let result = await arbitrage.swapSolForUxd(safeSolAmount)

    while (!result) {
      await wait(500)
      result = await arbitrage.swapSolForUxd(safeSolAmount)
    }
  }

  async sendPostArbMessage(success: boolean) {
    const endAmount = Wallet.getUiBalance(this.wallet.uxdBalance, 'UXD')
    this.discord.sendArbMsg({
      oldUxdUiAmount: this.arbStatus.startAmount,
      newUxdUiAmount: endAmount,
    }, success)

    logger('STATUS', `Ending arbitrage. Start balance: UXD ${this.arbStatus.startAmount}. End balance: UXD ${endAmount}`)
  }

  /**
   * @description Get price difference between MangoMarkets SOL perp bids and Jupiter best SOL to UXD offer
   */
  async getPriceDiff() {
    const { jupiterWatcher, mangoWatcher, wallet } = this

    const uxdBalance = Wallet.getUiBalance(wallet.uxdBalance, 'UXD')

    const jupiterSolPrice = await jupiterWatcher.getSolToUxdPrice()
    const perpSolPrice = MangoWatcher.getSolPerpPrice(uxdBalance, mangoWatcher.asks)

    const _priceDiff = (jupiterSolPrice / perpSolPrice - 1).toFixed(4)
    return +_priceDiff * 100
  }

  static async init() {
    const connection = new Connection(config.SOLANA_RPC_ENDPOINT, 'confirmed')

    const mangoWatcher = await MangoWatcher.init(connection)
    const jupiterWatcher = await JupiterWatcher.init(connection)

    const arbitrage = await Arbitrage.init({ connection, jupiter: jupiterWatcher.jupiter })
    const wallet = await Wallet.init(connection)

    const discord = await Discord.init()

    return new Bot({
      connection,
      mangoWatcher,
      jupiterWatcher,
      arbitrage,
      wallet,
      discord,
    })
  }
}
