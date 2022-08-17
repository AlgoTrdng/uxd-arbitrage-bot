import { Client, TextChannel } from 'discord.js'

import { Direction } from '../core/jupiter'
import { round } from '../helpers/amount'
import { sendArbResultMessage, setActivity } from './discord'
import { saveArbResult } from './firebase'
import { updateStatus } from './status'

type LogAndStartParams = {
  discordClient: Client
  direction: Direction
  suggestedInputAmount: number
  realInputAmount: number
}

export const logArbStart = async ({
  discordClient,
  direction,
  suggestedInputAmount,
  realInputAmount,
}: LogAndStartParams) => {
  console.log(
    `Starting ${direction} arbitrage. Suggested input: ${
      suggestedInputAmount
    } UXD, Real input: ${
      realInputAmount
    } UXD`,
  )
  setActivity(discordClient, direction)
  await updateStatus('startArb')
}

type LogArbEndParams = {
  discordChannel: TextChannel
  preArbUxdBalanceUi: number
  postArbUxdBalanceUi: number
  direction: Direction
}

export const logArbEnd = async ({
  discordChannel,
  preArbUxdBalanceUi,
  postArbUxdBalanceUi,
  direction,
}: LogArbEndParams) => {
  const oldAmountRounded = round(preArbUxdBalanceUi, 2)
  const newAmountRounded = round(postArbUxdBalanceUi, 2)

  const profitBps = round(postArbUxdBalanceUi / preArbUxdBalanceUi - 1, 4)
  console.log(
    `Executed ${direction} arbitrage. PreArbBalance: ${
      oldAmountRounded
    } UXD, PostArbBalance: ${
      newAmountRounded
    } UXD, Profit: ${profitBps * 100}%`,
  )
  await Promise.all([
    updateStatus('endArb'),
    sendArbResultMessage({
      channel: discordChannel,
      oldAmount: oldAmountRounded,
      newAmount: newAmountRounded,
      direction,
      profitBps,
    }),
    saveArbResult({
      oldAmount: preArbUxdBalanceUi,
      newAmount: postArbUxdBalanceUi,
      direction,
    }),
  ])
}
