import { Connection } from '@solana/web3.js'

import { startArbitrageLoop } from './bot/arbitrage'
import { initWrappers } from './lib/wrappers'
import { recordArbitrageTrades } from './bot/recorder'
import { state } from './state'
import config from './app.config'

(async () => {
  const connection = new Connection(config.SOL_RPC_ENDPOINT, 'confirmed')
  const wrappers = await initWrappers(connection)

  await state.syncAllBalances(connection)

  await recordArbitrageTrades()
  await startArbitrageLoop(connection, 10_000, wrappers)
})()
