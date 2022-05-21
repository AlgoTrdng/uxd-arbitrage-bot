import { Connection } from '@solana/web3.js'
import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { initJupiter } from './lib/utils/initJupiter'
import { initUxd } from './lib/utils/initUxd'
import Discord from './lib/discord'
import Watcher from './lib/scanner'
import User from './lib/user'
import Arbitrage from './lib/arbitrage'
import config from './app.config'
import { wait } from './lib/utils/wait'
import { logger } from './lib/utils/logger'

const BASE_WATCH_INTERVAL = 1000 * 30 // 30 seconds

type BotConfig = {
  watcher: Watcher
  arb: Arbitrage
  user: User
  discord: Discord
}

class Bot {
  static scanForArb(botConfig: BotConfig) {
    const intervalId = setInterval(async () => {
      const priceDiff = await botConfig.watcher.getPriceDiff()

      if (priceDiff > config.MIN_ARB_PERCENTAGE) {
        logger('STATUS', `Starting arbitrage, price diff: ${priceDiff}%`)
        clearInterval(intervalId)
        await Bot.executeArb(botConfig)
      }
    }, BASE_WATCH_INTERVAL)
  }

  static async executeArb(botConfig: BotConfig) {
    const {
      arb, watcher, discord, user,
    } = botConfig

    const startAmount = await arb.redeemUxd()
    await wait(500)
    await arb.swapSolForUxd()

    await user.fetchSplBalance('UXD')

    const [priceDiff] = await Promise.all([
      watcher.getPriceDiff(),
      discord.sendArbNotification({
        oldUxdUiAmount: startAmount / (10 ** UXD_DECIMALS),
        newUxdUiAmount: user.balances.UXD / (10 ** UXD_DECIMALS),
      }),
    ])

    if (priceDiff > config.MIN_ARB_PERCENTAGE) {
      await Bot.executeArb(botConfig)
      return
    }

    logger('STATUS', `Ending arbitrage, price diff: ${priceDiff}% < ${config.MIN_ARB_PERCENTAGE}%`)
    Bot.scanForArb(botConfig)
  }
}

(async () => {
  const connection = new Connection(config.SOLANA_RPC_ENDPOINT, 'confirmed')
  const jupiter = await initJupiter(connection)
  const uxdConfig = await initUxd(connection)

  const user = new User(connection)
  await user.fetchAllBalances()

  const watcher = new Watcher(connection, jupiter)
  await watcher.init()

  const arb = new Arbitrage(connection, jupiter, user, uxdConfig)

  const discord = new Discord()
  await discord.init()
  logger('STATUS', 'Setup ready, scanning for arbitrage.')

  Bot.scanForArb({
    watcher, arb, user, discord,
  })
})()
