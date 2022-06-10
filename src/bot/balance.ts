import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS } from '@uxd-protocol/uxd-client'

import { mint } from '../constants'
import { fetchLamportsBalance, fetchSplBalance } from '../lib/account'
import { MINIMUM_SOL_CHAIN_AMOUNT, swapSolToUxd } from '../lib/actions/swap'
import { getUiAmount } from '../lib/utils/amount'
import { wait } from '../lib/utils/wait'
import { state } from '../state'
import { JupiterWrapper } from '../wrappers/jupiter'

export const syncUxdBalance = async (connection: Connection) => {
  const uxdBalance = await fetchSplBalance(connection, mint.UXD)
  state.uxdChainBalance = uxdBalance
}

export const syncSolBalance = async (connection: Connection) => {
  const solBalance = await fetchLamportsBalance(connection)
  state.solChainBalance = solBalance
}

export const syncBalances = async (connection: Connection) => {
  await Promise.all([
    syncUxdBalance(connection),
    syncSolBalance(connection),
  ])
}

const WATCH_SOL_INTERVAL_PERIOD = 30_000
/**
 * @description Periodically fetch SOL balance to swap back if redemption stops because of low price diff but transaction goes through
 */
export const watchRemainingSol = async (connection: Connection, jupiterWrapper: JupiterWrapper) => {
  await wait(WATCH_SOL_INTERVAL_PERIOD)
  console.log('Watching for remaining SOL')

  if (state.appStatus.value !== 'scanning') {
    await watchRemainingSol(connection, jupiterWrapper)
    return
  }

  const solChainBalance = await fetchLamportsBalance(connection)

  if (solChainBalance > MINIMUM_SOL_CHAIN_AMOUNT) {
    const solUiBalance = getUiAmount(solChainBalance, SOL_DECIMALS)
    // TODO: Properly check whether was successful
    await swapSolToUxd(jupiterWrapper, solUiBalance)
    await syncBalances(connection)
  }

  await watchRemainingSol(connection, jupiterWrapper)
}
