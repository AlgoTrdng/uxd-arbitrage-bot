import { Connection } from '@solana/web3.js'

import { mint } from './constants'
import { fetchSplBalance } from './lib/utils/account'
import { ref } from './lib/utils/ref'
import { force } from './lib/utils/force'
import config from './app.config'

export const AppStatuses = {
  SCANNING: 'SCANNING',
  REDEEMING: 'REDEEMING',
  SWAPPING: 'SWAPPING',
  RE_BALANCING: 'RE_BALANCING',
} as const

export const state = {
  uxdChainBalance: 0,
  solChainBalance: 0,

  appStatus: ref<keyof typeof AppStatuses>('SCANNING'),

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
    this.solChainBalance = solChainBalance
  },
  async syncAllBalances(connection: Connection) {
    await Promise.all([
      this.syncUxdBalance(connection),
      this.syncSolBalance(connection),
    ])
  },
}
