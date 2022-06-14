import {
  Client,
  ColorResolvable,
  EmbedField,
  Intents,
  MessageEmbed,
  TextChannel,
} from 'discord.js'

import config from '../../app.config'
import { logger } from '../utils/logger'

export type EmbedConfig = {
  description?: string
  color?: ColorResolvable
  fields?: EmbedField[]
}

export class DiscordWrapper {
  client: Client
  channel: TextChannel

  constructor(client: Client, channel: TextChannel) {
    this.client = client
    this.channel = channel

    this.client.on('ready', () => {
      logger('STATUS', 'Discord client ready!')
    })
  }

  static async init() {
    const client = new Client({ intents: [Intents.FLAGS.DIRECT_MESSAGES] })
    await client.login(config.DISCORD_TOKEN)

    const channel = await client.channels.fetch(config.DISCORD_CHANNEL_ID) as TextChannel
    await channel.send('🤖 Arbitrage bot started, scanning for arbitrage and listening for updates.')

    return new DiscordWrapper(client, channel)
  }

  async sendEmbed(embedConfig: EmbedConfig) {
    const { description, color, fields } = embedConfig
    const embed = new MessageEmbed({
      description,
      fields,
    })

    if (color) {
      embed.setColor(color)
    }

    await this.channel.send({ embeds: [embed] })
  }
}

type DiscordMessageData = {
  oldAmount: number
  newAmount: number
  wasSuccessful: boolean
  profitPercentage: number
}

export const createDiscordMessageData = (messageData: DiscordMessageData): EmbedConfig => {
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
