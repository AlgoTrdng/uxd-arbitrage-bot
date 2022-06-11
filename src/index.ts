import { Connection } from '@solana/web3.js'

import { startArbitrageLoop } from './bot/arbitrage'
import { syncBalances } from './bot/balance'
import { initWrappers } from './wrappers'
import config from './app.config'
import { recordArbitrageTrades } from './bot/recorder'

(async () => {
  const connection = new Connection(config.SOL_RPC_ENDPOINT, 'confirmed')
  const wrappers = await initWrappers(connection)

  recordArbitrageTrades()
  await syncBalances(connection)
  await startArbitrageLoop(connection, 10_000, wrappers)
})()
