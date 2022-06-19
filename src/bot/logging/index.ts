import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'
import { EmbedField } from 'discord.js'

import { listenForEvent } from '../../lib/utils/eventEmitter'
import { DiscordWrapper } from '../../lib/wrappers/discord'
import { AppStatuses, state } from '../../state'
import { logAndSaveTrade } from './utils'

const getMessageAmount = (amount: number, decimals: number) => (
  Number(
    (amount / (10 ** decimals))
      .toFixed(2),
  )
)

const recordArbitrageTrades = (discordWrapper: DiscordWrapper) => {
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

const watchAndSyncActivities = (discordWrapper: DiscordWrapper) => {
  discordWrapper.setActivity(AppStatuses.SCANNING)

  state.appStatus.watch((currentStatus) => {
    discordWrapper.setActivity(currentStatus)
  })
}

const logReBalancing = async (discordWrapper: DiscordWrapper) => {
  listenForEvent('re-balance-success', async ({ preUxdChainBalance, postUxdChainBalance }) => {
    const preUxdUiAmount = getMessageAmount(preUxdChainBalance, UXD_DECIMALS)
    const postUxdUiAmount = getMessageAmount(postUxdChainBalance, UXD_DECIMALS)

    const embedFields: EmbedField[] = [
      {
        name: 'Old amount',
        value: `UXD ${preUxdUiAmount}`,
        inline: true,
      },
      {
        name: 'New amount',
        value: `UXD ${postUxdUiAmount}`,
        inline: true,
      },
    ]

    await discordWrapper.sendEmbed({
      description: 'Successfully swapped UXD to USDC',
      fields: embedFields,
      color: '#FFAA2B',
    })
  })
}

export const initStatsLogging = async () => {
  const discordWrapper = await DiscordWrapper.loginAndFetchChannel()

  recordArbitrageTrades(discordWrapper)
  watchAndSyncActivities(discordWrapper)
  logReBalancing(discordWrapper)
}
