import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'
import { EmbedField } from 'discord.js'

import { logArbitrageStatus } from '../lib/utils/logger'
import { state } from '../state'
import { DiscordWrapper, EmbedConfig } from '../wrappers/discord'

const getPercentageFromBps = (bps: number) => Number((bps * 100).toFixed(2))
const getMessageAmount = (amount: number, decimals: number) => (
  Number(
    (amount / (10 ** decimals))
      .toFixed(2),
  )
)

type StatusMessage = {
  oldAmount: number
  newAmount: number
  profit: number
  type: 'redeem'
  wasSuccessful: boolean
  executedAt: Date
}

const createStatusMessage = (
  preArbitrageUiBalance: number,
  postArbitrageUiBalance: number,
  success: boolean,
): StatusMessage => {
  const profitBps = postArbitrageUiBalance / preArbitrageUiBalance - 1
  return {
    oldAmount: preArbitrageUiBalance,
    newAmount: postArbitrageUiBalance,
    wasSuccessful: success,
    profit: Number(profitBps.toFixed(4)),
    type: 'redeem',
    executedAt: new Date(),
  }
}

type DiscordMessageData = {
  oldAmount: number
  newAmount: number
  wasSuccessful: boolean
  profitPercentage: number
}

const createDiscordMessageData = (messageData: DiscordMessageData): EmbedConfig => {
  const {
    oldAmount, newAmount, wasSuccessful, profitPercentage,
  } = messageData

  const fields: EmbedField[] = [
    {
      name: 'Old amount',
      value: `UXD ${oldAmount}`,
      inline: true,
    },
    {
      name: 'New amount',
      value: `UXD ${newAmount}`,
      inline: true,
    },
    {
      name: 'Profit',
      value: `${profitPercentage}%`,
      inline: true,
    },
  ]
  return {
    description: `Executed ${wasSuccessful ? 'successful' : 'unsuccessful'} **REDEEM** arbitrage`,
    color: profitPercentage > 0 ? '#78EA4A' : '#EB5757',
    fields,
  }
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

      const statusMessage = createStatusMessage(preArbitrageMessageBalance!, postArbitrageMessageBalance, false)
      const profitPercentage = getPercentageFromBps(statusMessage.profit)
      const discordMessage = createDiscordMessageData({
        ...statusMessage,
        profitPercentage,
      })

      await discordWrapper.sendEmbed(discordMessage)
      logArbitrageStatus(
        statusMessage.oldAmount,
        statusMessage.newAmount,
        profitPercentage,
        statusMessage.wasSuccessful,
      )
      preArbitrageMessageBalance = null
      return
    }

    // Arbitrage was successful
    // preArbitrageMessageBalance should always be defined in this case
    if (newStatus === 'scanning' && prevStatus === 'inArbitrage') {
      const postArbitrageMessageBalance = getMessageAmount(state.uxdChainBalance, UXD_DECIMALS)

      const statusMessage = createStatusMessage(preArbitrageMessageBalance!, postArbitrageMessageBalance, true)
      const profitPercentage = getPercentageFromBps(statusMessage.profit)
      const discordMessage = createDiscordMessageData({
        ...statusMessage,
        profitPercentage,
      })

      await discordWrapper.sendEmbed(discordMessage)
      logArbitrageStatus(
        statusMessage.oldAmount,
        statusMessage.newAmount,
        profitPercentage,
        statusMessage.wasSuccessful,
      )
      preArbitrageMessageBalance = null
    }
  })
}
