import { Connection } from '@solana/web3.js'

import { startArbitrageLoop } from './bot/arbitrage'
import { syncBalances, watchRemainingSol } from './bot/balance'
import { initWrappers } from './wrappers'
import config from './app.config'
import { recordArbitrageTrades } from './bot/recorder'

(async () => {
  const connection = new Connection(config.SOL_RPC_ENDPOINT, 'confirmed')
  const wrappers = await initWrappers(connection)

  await syncBalances(connection)

  recordArbitrageTrades()
  watchRemainingSol(connection, wrappers.jupiterWrapper)

  await startArbitrageLoop(connection, 10_000, wrappers)
})()
