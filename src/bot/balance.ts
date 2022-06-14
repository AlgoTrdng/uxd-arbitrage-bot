import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS } from '@uxd-protocol/uxd-client'

import { MINIMUM_SOL_CHAIN_AMOUNT, mint } from '../constants'
import { fetchLamportsBalance, fetchSplBalance } from '../lib/account'
import { swapSolToUxd } from '../lib/actions/swap'
import { getUiAmount } from '../lib/utils/amount'
import { getTs } from '../lib/utils/getTimestamp'
import { wait } from '../lib/utils/wait'
import { state } from '../state'
import { JupiterWrapper } from '../lib/wrappers'
import { Collections, saveDocument } from '../lib/wrappers/firebase'

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

export const watchRemainingSol = (connection: Connection, jupiterWrapper: JupiterWrapper) => {
  const MAX_WATCH_TIME = 60_000

  state.appStatus.watch(async (newStatus) => {
    if (newStatus === 'monitoringRemainingSol') {
      let shouldWatch = true
      const watchStartTime = getTs()

      let elapsedMs: number | null = null

      while (shouldWatch && getTs() - watchStartTime < MAX_WATCH_TIME) {
        const solChainBalance = await fetchLamportsBalance(connection)

        if (solChainBalance > MINIMUM_SOL_CHAIN_AMOUNT) {
          // Logging
          elapsedMs = getTs() - watchStartTime

          state.appStatus.value = 'swappingRemainingSol'
          const solUiBalance = getUiAmount(solChainBalance, SOL_DECIMALS)
          let swapResult = await swapSolToUxd(jupiterWrapper, solUiBalance)

          while (!swapResult) {
            wait(500)
            swapResult = await swapSolToUxd(jupiterWrapper, solUiBalance)
          }

          const { outputAmount } = swapResult

          await syncUxdBalance(connection)
          // Balance after swap has to be equal or higher than swap output amount
          while (state.uxdChainBalance < outputAmount) {
            await wait()
            await syncUxdBalance(connection)
          }
          break
        }

        await wait(2000)
      }

      await saveDocument(Collections.fails, watchStartTime.toString(), {
        elapsedMs,
        didSwap: Boolean(elapsedMs),
      })

      shouldWatch = false
      state.appStatus.value = 'scanning'
    }
  })
}
