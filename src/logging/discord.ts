import {
  ActivityType,
  Client,
  EmbedBuilder,
  TextChannel,
} from 'discord.js'

import { Direction } from '../core/jupiter'
import { secrets } from '../config'
import { round } from '../helpers/amount'

export const setActivity = (client: Client, arbDirection?: Direction) => {
  if (!arbDirection) {
    client.user?.setActivity('markets', { type: ActivityType.Watching })
  } else {
    client.user?.setActivity(arbDirection, { type: ActivityType.Playing })
  }
}

export const initDiscord = async () => {
  const client = new Client({ intents: ['GuildMessages'] })
  await client.login(secrets.DISCORD_SECRET)

  const channel = await client.channels.fetch(secrets.DISCORD_CHANNEL_ID) as TextChannel | null

  if (!channel) {
    throw Error(`Could not find channel with id: ${secrets.DISCORD_CHANNEL_ID}`)
  }

  await channel.send(
    '🤖 Arbitrage bot started, scanning for arbitrage and listening for updates.',
  )
  setActivity(client)

  return {
    client,
    channel,
  }
}

const createInlineField = (name: string, value: string) => ({
  inline: true,
  name,
  value,
})

type ArbResultMessageParams = {
  channel: TextChannel
  oldAmount: number
  newAmount: number
  profitBps: number
  direction: Direction
}

export const sendArbResultMessage = async ({
  channel,
  oldAmount,
  newAmount,
  profitBps,
  direction,
}: ArbResultMessageParams) => {
  const profitPercentage = round(profitBps * 100, 2)

  const embed = new EmbedBuilder({
    color: profitBps >= 0 ? 0x78EA4A : 0xEB5757,
    description: `Executed **${direction}** arbitrage`,
    fields: [
      createInlineField('Old amount', `UXD ${oldAmount}`),
      createInlineField('New amount', `UXD ${newAmount}`),
      createInlineField('Profit', `${profitPercentage}%`),
    ],
  })

  await channel.send({
    embeds: [embed],
  })
}

type ReBalanceMessageParams = {
  channel: TextChannel
  oldAmount: number
  newAmount: number
}

export const sendReBalanceMessage = async ({
  channel,
  oldAmount,
  newAmount,
}: ReBalanceMessageParams) => {
  const embed = new EmbedBuilder({
    color: 0xffaa2b,
    description: 'Successfully swapped UXD to USDC',
    fields: [
      createInlineField('Old amount', `UXD ${oldAmount}`),
      createInlineField('New amount', `UXD ${newAmount}`),
    ],
  })

  await channel.send({
    embeds: [embed],
  })
}
