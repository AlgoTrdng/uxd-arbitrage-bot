import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { logArbitrageStatus } from '../lib/utils/logger'
import { DiscordWrapper, createDiscordMessageData } from '../lib/wrappers/discord'
import { Collections, createFirebaseDocumentData, saveDocument } from '../lib/wrappers/firebase'
import { listenForEvent } from '../lib/eventEmitter'
import { wait } from '../lib/utils/wait'

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
  const discordWrapper = await DiscordWrapper.loginAndFetchChannel()

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
