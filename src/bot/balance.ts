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

const WATCH_SOL_INTERVAL_PERIOD = 20_000
/**
 * @description Periodically fetch SOL balance to swap back if redemption stops because of low price diff but transaction goes through
 */
export const watchRemainingSol = async (connection: Connection, jupiterWrapper: JupiterWrapper) => {
  await wait(WATCH_SOL_INTERVAL_PERIOD)
  console.log('Watching remaining SOL')

  if (state.appStatus.value !== 'scanning') {
    await watchRemainingSol(connection, jupiterWrapper)
    return
  }

  const remainingSolChainBalance = await fetchLamportsBalance(connection)

  if (remainingSolChainBalance > MINIMUM_SOL_CHAIN_AMOUNT) {
    const remainingSolUiBalance = getUiAmount(remainingSolChainBalance, SOL_DECIMALS)
    let swapResult = await swapSolToUxd(jupiterWrapper, remainingSolUiBalance)

    while (!swapResult) {
      await wait()
      swapResult = await swapSolToUxd(jupiterWrapper, remainingSolUiBalance)
    }

    await syncSolBalance(connection)
    while (state.solChainBalance === remainingSolChainBalance) {
      await syncSolBalance(connection)
      wait(500)
    }

    const preSwapUxdBalance = state.uxdChainBalance
    await syncUxdBalance(connection)
    while (preSwapUxdBalance === state.uxdChainBalance) {
      await syncUxdBalance(connection)
      wait(500)
    }
  }

  await watchRemainingSol(connection, jupiterWrapper)
}
