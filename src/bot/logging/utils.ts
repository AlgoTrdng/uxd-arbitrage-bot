import { DiscordWrapper, createDiscordMessageData } from '../../lib/wrappers/discord'
import { createFirebaseDocumentData, saveDocument, Collections } from '../../lib/wrappers/firebase'

const getPercentageFromBps = (bps: number) => Number((bps * 100).toFixed(2))

type LogAndSaveTradeConfig = {
  preArbBalance: number
  postArbBalance: number
  success: boolean
}

export const logAndSaveTrade = async (discordWrapper: DiscordWrapper, config: LogAndSaveTradeConfig) => {
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

  console.log(
    `Executed arbitrage; profit: ${
      profitPercentage
    }, oldAmount: ${
      statusMessage.oldAmount
    }, newAmount: ${
      statusMessage.newAmount
    }`,
  )
}
