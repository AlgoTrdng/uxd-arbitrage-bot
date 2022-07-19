import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { listenForEvent } from '../../lib/utils/eventEmitter'
import { DiscordWrapper } from './helpers/discord'
import { saveToFirebase } from './helpers/firebase'
import { AppStatuses, ArbitrageType, state } from '../../state'

const getMessageAmount = (amount: number, decimals: number) => (
  Number(
    (amount / (10 ** decimals))
      .toFixed(2),
  )
)

export const initLogging = async () => {
  const discordWrapper = await DiscordWrapper.loginAndFetchChannel();

  // --------------------------
  // LISTEN FOR ARB EXECUTION
  (() => {
    let preArbitrageUxdBalance: number | null = null
    let arbType: ArbitrageType | null = null

    listenForEvent('arbitrage-start', ({
      uxdChainBalance,
      type,
    }) => {
      arbType = type
      preArbitrageUxdBalance = getMessageAmount(uxdChainBalance, UXD_DECIMALS)
    })

    listenForEvent('arbitrage-success', async (uxdChainBalance) => {
      if (!preArbitrageUxdBalance || !arbType) {
        console.error('Pre arbitrage balance and arb type was not defined')
        return
      }

      const postArbitrageUxdBalance = getMessageAmount(uxdChainBalance, UXD_DECIMALS)
      const profitBps = postArbitrageUxdBalance / preArbitrageUxdBalance - 1
      const profitPercentage = Number((profitBps * 100).toFixed(2))

      await Promise.all([
        discordWrapper.sendArbitrageMessage({
          oldAmount: preArbitrageUxdBalance,
          newAmount: postArbitrageUxdBalance,
          type: arbType,
          profitPercentage,
        }),
        saveToFirebase({
          preArbitrageUiBalance: preArbitrageUxdBalance,
          postArbitrageUiBalance: postArbitrageUxdBalance,
          type: arbType,
          profitBps,
        }),
      ])

      console.log(`Executed ${arbType} arbitrage:`, {
        profit: `${profitPercentage}%`,
        preArbitrageUxdBalance,
        postArbitrageUxdBalance,
      })

      preArbitrageUxdBalance = null
      arbType = null
    })
  })()

  // --------------------------
  // LISTEN FOR ACTIVITIES
  discordWrapper.setActivity(AppStatuses.SCANNING)

  state.appStatus.watch((currentStatus) => {
    discordWrapper.setActivity(currentStatus)
  })

  // --------------------------
  // LISTEN FOR RE-BALANCE EVENT
  listenForEvent('re-balance-success', async ({ preUxdChainBalance, postUxdChainBalance }) => {
    const preUxdUiAmount = getMessageAmount(preUxdChainBalance, UXD_DECIMALS)
    const postUxdUiAmount = getMessageAmount(postUxdChainBalance, UXD_DECIMALS)

    await discordWrapper.sendReBalanceMessage({
      oldAmount: preUxdUiAmount,
      newAmount: postUxdUiAmount,
    })
  })
}
