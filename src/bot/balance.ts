import { Connection } from '@solana/web3.js'

import { mint } from '../constants'
import {
  fetchLamportsBalance,
  fetchSplBalance,
} from '../lib/account'
import { state } from '../state'

export const syncUxdBalance = async (connection: Connection) => {
  const uxdBalance = await fetchSplBalance(connection, mint.UXD)
  state.uxdChainBalance = uxdBalance
}

export const syncSolBalance = async (connection: Connection) => {
  const solBalance = await fetchLamportsBalance(connection)
  state.solChainBalance = solBalance
}

export const initBalances = async (connection: Connection) => {
  await Promise.all([
    syncUxdBalance(connection),
    syncSolBalance(connection),
  ])
}
