import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { listenForEvent } from '../../lib/utils/eventEmitter'
import { DiscordWrapper } from '../../lib/wrappers/discord'
import { AppStatuses, state } from '../../state'
import { logAndSaveTrade } from './utils'

export const getMessageAmount = (amount: number, decimals: number) => (
  Number(
    (amount / (10 ** decimals))
      .toFixed(2),
  )
)

export const recordArbitrageTrades = async (discordWrapper: DiscordWrapper) => {
  let preArbitrageUxdBalance: number | null = null

  listenForEvent('arbitrage-start', (uxdChainBalance) => {
    preArbitrageUxdBalance = getMessageAmount(uxdChainBalance, UXD_DECIMALS)
  })

  listenForEvent('arbitrage-success', async (uxdChainBalance) => {
    if (!preArbitrageUxdBalance) {
      console.log('Pre arbitrage balance was not defined')
      return
    }

    const postArbitrageUxdBalance = getMessageAmount(uxdChainBalance, UXD_DECIMALS)
    await logAndSaveTrade(discordWrapper, {
      preArbBalance: preArbitrageUxdBalance,
      postArbBalance: postArbitrageUxdBalance,
      success: true,
    })

    preArbitrageUxdBalance = null
  })
}

export const watchAndSyncActivities = (discordWrapper: DiscordWrapper) => {
  discordWrapper.setActivity(AppStatuses.SCANNING)

  state.appStatus.watch((currentStatus) => {
    discordWrapper.setActivity(currentStatus)
  })
}
