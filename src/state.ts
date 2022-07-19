import { Connection } from '@solana/web3.js'

import { mint } from './constants'
import { fetchSplBalance } from './lib/utils/fetchSplBalance'
import { ref } from './lib/utils/ref'
import { forceOnError } from './lib/utils/force'
import config from './app.config'

export const AppStatuses = {
  SCANNING: 'scanning',
  MINTING: 'minting',
  REDEEMING: 'redeeming',
  RE_BALANCING: 're-balancing',
} as const

type AppStatusesType = typeof AppStatuses

export type AppStatus = AppStatusesType[keyof AppStatusesType]
export type ArbitrageType = AppStatusesType['MINTING'] | AppStatusesType['REDEEMING']

export const state = {
  uxdChainBalance: 0,
  solChainBalance: 0,

  appStatus: ref<AppStatus>('scanning'),

  async syncUxdBalance(connection: Connection) {
    this.uxdChainBalance = await forceOnError(
      () => fetchSplBalance(connection, mint.UXD),
      500,
    )
  },
  async syncSolBalance(connection: Connection) {
    this.solChainBalance = await forceOnError(
      () => connection.getBalance(config.SOL_PUBLIC_KEY),
      500,
    )
  },
  async syncAllBalances(connection: Connection) {
    await Promise.all([
      this.syncUxdBalance(connection),
      this.syncSolBalance(connection),
    ])
  },
}
