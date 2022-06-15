import { Connection } from '@solana/web3.js'

import { mint } from './constants'
import { fetchSplBalance } from './lib/account'
import { ref } from './lib/utils/ref'
import { force } from './lib/utils/force'
import config from './app.config'

/**
 * scanning -> Not in arbitrage, scanning price difference
 * inArbitrage -> Started arbitrage, price diff was high enough
 * re-balancing -> UXD amount is too high, swapping for UXD
 */
type AppStatus = 're-balancing' | 'inArbitrage' | 'scanning'

export const state = {
  uxdChainBalance: 400,
  solChainBalance: 0,
  wrappedSolChainBalance: 0,

  appStatus: ref<AppStatus>('scanning'),

  async syncUxdBalance(connection: Connection) {
    const uxdBalance = await force(
      () => fetchSplBalance(connection, mint.UXD),
      { wait: 200 },
    )
    this.uxdChainBalance = uxdBalance
  },
  async syncSolBalance(connection: Connection) {
    const solChainBalance = await force(
      () => connection.getBalance(config.SOL_PUBLIC_KEY),
      { wait: 200 },
    )
    state.solChainBalance = solChainBalance
  },
  async syncAllBalances(connection: Connection) {
    await Promise.all([
      this.syncUxdBalance(connection),
      this.syncSolBalance(connection),
    ])
  },
}
