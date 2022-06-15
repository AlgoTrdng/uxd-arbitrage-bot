import { logArbitrageStatus } from '../../lib/utils/logger'
import { DiscordWrapper, createDiscordMessageData } from '../../lib/wrappers/discord'
import { createFirebaseDocumentData, saveDocument, Collections } from '../../lib/wrappers/firebase'

const getPercentageFromBps = (bps: number) => Number((bps * 100).toFixed(2))

type logAndSaveTradeConfig = {
  preArbBalance: number
  postArbBalance: number
  success: boolean
}

export const logAndSaveTrade = async (discordWrapper: DiscordWrapper, config: logAndSaveTradeConfig) => {
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
    saveDocument(Collections.trades, statusMessage.executedAt.getTime().toString(), statusMessage),
  ])

  logArbitrageStatus(
    statusMessage.oldAmount,
    statusMessage.newAmount,
    profitPercentage,
    statusMessage.wasSuccessful,
  )
}
