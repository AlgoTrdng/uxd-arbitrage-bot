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
        this.startArbitrage()
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
  async start() {
    this.watchSolChange()
    await this.mangoWatcher.watchSolPerpBids()

    const watchJupiter = async () => {
      if (!this.mangoWatcher.asks.length) {
        setTimeout(watchJupiter, 1000 * 30)
        return
      }

      const priceDiff = await this.getPriceDiff()
      this.priceDiff.value = priceDiff
      setTimeout(watchJupiter, 1000 * 30)
    }

    // Wait for all connections to establish
    setTimeout(watchJupiter, 1000 * 10)
  }

  /**
   * @description Execute first step of arbitrage, redeem UXD for SOL
   */
  async startArbitrage() {
    logger('STATUS', 'Executing arbitrage')
    const startAmount = await this.redeemUxd()

    if (!startAmount) {
      this.arbStatus.executing = false
      return
    }
    this.arbStatus.startAmount = startAmount
  }

  /**
   * @description Initialize account change watcher websocket connection
   */
  watchSolChange() {
    this.connection.onAccountChange(config.SOL_PUBLIC_KEY, async (accountInfo) => {
      const { lamports } = accountInfo

      // if SOL balance changes to higher than 0.11, swap back to UXD
      if (lamports > 0.11 * (10 ** SOL_DECIMALS)) {
        await this.swapSolForUxd(lamports)

        const { startAmount } = this.arbStatus

        if (startAmount) {
          await this.wallet.fetchUxdBalance()
          const endAmount = Wallet.getUiBalance(this.wallet.uxdBalance)
          logger('STATUS', `Ending arbitrage. Start balance: UXD ${startAmount}. End balance: UXD ${endAmount}`)

          this.discord.sendArbNotification({
            oldUxdUiAmount: startAmount,
            newUxdUiAmount: endAmount,
          })

          this.arbStatus = {
            startAmount: 0,
            executing: false,
          }
          return
        }

        logger('STATUS', 'Arb failed due to price diff being too low, swapping residual SOL to UXD')
      }
    })
  }

  /**
   * @description Returns false if priceDiff is lower than MIN_ARB_PERCENTAGE
   */
  async redeemUxd() {
    const { arbitrage, wallet } = this

    await wallet.fetchUxdBalance()
    const startingUxdBalance = Wallet.getUiBalance(wallet.uxdBalance)

    // if starting balance is lower than 10, swap back to UXD from previous failed redemption has not been confirmed yet
    if (startingUxdBalance < 10) {
      logger('REDEMPTION', 'Uxd balance is too low, swap back to UXD from previous failed redemption has not been confirmed yet')
      return null
    }

    const redeemTx = this.arbitrage.createRedeemTransaction(wallet.uxdBalance)
    let success = await arbitrage.sendAndConfirmRedeem(redeemTx)

    while (!success) {
      await wait(500)

      await this.wallet.fetchUxdBalance()
      // If new uxd balance is lower than old uxd balance, redemption was successful
      if (this.wallet.uxdBalance < this.wallet.uxdOldBalance) {
        return startingUxdBalance
      }

      logger('REDEMPTION', 'Redemption failed, retrying...')

      const priceDiff = await this.getPriceDiff()
      if (priceDiff < config.MIN_ARB_PERCENTAGE) {
        logger('REDEMPTION', 'Ending redemption, price diff is too low')
        return null
      }

      success = await arbitrage.sendAndConfirmRedeem(redeemTx)
    }

    return startingUxdBalance
  }

  /**
   * @description Swap SOL for UXD, repeat swap until it is successful
   */
  async swapSolForUxd(lamportsBalance: number) {
    const { arbitrage } = this

    const safeSolAmount = Arbitrage.getSafeSolAmount(lamportsBalance)
    let result = await arbitrage.swapSolForUxd(safeSolAmount)

    while (!result) {
      await wait(500)
      result = await arbitrage.swapSolForUxd(safeSolAmount)
    }
  }

  /**
   * @description Get price difference between MangoMarkets SOL perp bids and Jupiter best SOL to UXD offer
   */
  async getPriceDiff() {
    const { jupiterWatcher, mangoWatcher } = this

    const jupiterSolPrice = await jupiterWatcher.getSolToUxdPrice()
    const [highestMangoBid] = mangoWatcher.asks[0]
    const _priceDiff = (jupiterSolPrice / highestMangoBid - 1).toFixed(4)
    return +_priceDiff * 100
  }

  static async init() {
    const connection = new Connection(config.SOLANA_RPC_ENDPOINT, 'confirmed')

    const mangoWatcher = await MangoWatcher.init(connection)
    const jupiterWatcher = await JupiterWatcher.init(connection)

    const arbitrage = await Arbitrage.init({ connection, jupiter: jupiterWatcher.jupiter })
    const wallet = new Wallet(connection)

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
