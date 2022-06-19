import { Connection } from '@solana/web3.js'

import { startArbitrageLoop } from './bot/arbitrage'
import { initWrappers } from './lib/wrappers'
import { initStatsLogging } from './bot/logging'
import { state } from './state'
import config from './app.config'
import { watchStatusAndReBalance } from './bot/reBalance'

(async () => {
  const connection = new Connection(config.SOL_RPC_ENDPOINT, 'confirmed')
  const wrappers = await initWrappers(connection)

  await state.syncAllBalances(connection)

  await initStatsLogging()
  watchStatusAndReBalance(connection, wrappers.jupiterWrapper)
  await startArbitrageLoop(connection, 10_000, wrappers)
})()
