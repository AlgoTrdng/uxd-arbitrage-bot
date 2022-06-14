import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { logArbitrageStatus } from '../lib/utils/logger'
import { state } from '../state'
import { DiscordWrapper, createDiscordMessageData } from '../lib/wrappers/discord'
import { Collections, createFirebaseDocumentData, saveDocument } from '../lib/wrappers/firebase'

const getPercentageFromBps = (bps: number) => Number((bps * 100).toFixed(2))
const getMessageAmount = (amount: number, decimals: number) => (
  Number(
    (amount / (10 ** decimals))
      .toFixed(2),
  )
)

type logAndSaveTradeConfig = {
  preArbBalance: number
  postArbBalance: number
  success: boolean
}

const logAndSaveTrade = async (discordWrapper: DiscordWrapper, config: logAndSaveTradeConfig) => {
  const { preArbBalance, postArbBalance, success } = config
  const statusMessage = createFirebaseDocumentData(preArbBalance, postArbBalance, success)
  const profitPercentage = getPercentageFromBps(statusMessage.profit)
  const discordMessage = createDiscordMessageData({
    oldAmount: preArbBalance,
    newAmount: postArbBalance,
    wasSuccessful: success,
    profitPercentage,
  })

  await Promise.all([
    discordWrapper.sendEmbed(discordMessage),
    // saveDocument(Collections.trades, statusMessage.executedAt.getTime().toString(), statusMessage),
  ])

  logArbitrageStatus(
    statusMessage.oldAmount,
    statusMessage.newAmount,
    profitPercentage,
    statusMessage.wasSuccessful,
  )
}

export const recordArbitrageTrades = async () => {
  const discordWrapper = await DiscordWrapper.init()

  let preArbitrageMessageBalance: number | null = null

  state.appStatus.watch(async (newStatus, prevStatus) => {
    // Start arbitrage
    if (newStatus === 'inArbitrage') {
      preArbitrageMessageBalance = getMessageAmount(state.uxdChainBalance, UXD_DECIMALS)
      return
    }

    // Remaining SOL from previous failed redemption was swapped for UXD
    // preArbitrageMessageBalance should always be defined in this case
    if (newStatus === 'scanning' && prevStatus === 'swappingRemainingSol') {
      const postArbitrageMessageBalance = getMessageAmount(state.uxdChainBalance, UXD_DECIMALS)
      await logAndSaveTrade(discordWrapper, {
        preArbBalance: preArbitrageMessageBalance!,
        postArbBalance: postArbitrageMessageBalance,
        success: false,
      })

      preArbitrageMessageBalance = null
      return
    }

    // Arbitrage was successful
    // preArbitrageMessageBalance should always be defined in this case
    if (newStatus === 'scanning' && prevStatus === 'inArbitrage') {
      const postArbitrageMessageBalance = getMessageAmount(state.uxdChainBalance, UXD_DECIMALS)
      await logAndSaveTrade(discordWrapper, {
        preArbBalance: preArbitrageMessageBalance!,
        postArbBalance: postArbitrageMessageBalance,
        success: true,
      })

      preArbitrageMessageBalance = null
    }
  })
}
