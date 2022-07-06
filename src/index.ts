import { Connection } from '@solana/web3.js'

import { startArbitrageLoop } from './core/arbitrage'
import { initWrappers } from './lib/solana'
import { initLogging } from './core/logging'
import { state } from './state'
import config from './app.config'
import { watchStatusAndReBalance } from './core/reBalance'

(async () => {
  const connection = new Connection(config.SOL_RPC_ENDPOINT, 'confirmed')
  const wrappers = await initWrappers(connection)

  await state.syncAllBalances(connection)

  await initLogging()
  watchStatusAndReBalance(connection, wrappers.jupiterWrapper)

  await startArbitrageLoop(connection, 10_000, wrappers)
})()
