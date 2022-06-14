import { Connection } from '@solana/web3.js'

import { mint } from './constants'
import { fetchLamportsBalance, fetchSplBalance } from './lib/account'
import { ref } from './lib/reactive'

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
    const uxdBalance = await fetchSplBalance(connection, mint.UXD)
    this.uxdChainBalance = uxdBalance
  },
  async syncSolBalance(connection: Connection) {
    const solBalance = await fetchLamportsBalance(connection)
    state.solChainBalance = solBalance
  },
  async syncAllBalances(connection: Connection) {
    await Promise.all([
      this.syncUxdBalance(connection),
      this.syncSolBalance(connection),
    ])
  },
}
