import { Connection } from '@solana/web3.js'

import { startArbitrageLoop } from './bot/arbitrage'
import { initBalances } from './bot/balance'
import config from './app.config'

(async () => {
  const connection = new Connection(config.SOL_RPC_ENDPOINT, 'confirmed')

  await initBalances(connection)
  await startArbitrageLoop(connection, 10_000)
})()
