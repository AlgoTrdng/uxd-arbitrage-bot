import {
  Client,
  ColorResolvable,
  EmbedField,
  Intents,
  MessageEmbed,
  TextChannel,
} from 'discord.js'

import config from '../../app.config'
import { AppStatuses } from '../../state'

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
  }

  static async loginAndFetchChannel() {
    const client = new Client({ intents: [Intents.FLAGS.DIRECT_MESSAGES] })
    await client.login(config.DISCORD_TOKEN)

    const channel = await client.channels.fetch(config.DISCORD_CHANNEL_ID) as TextChannel
    await channel.send('🤖 Arbitrage bot started, scanning for arbitrage and listening for updates.')

    return new DiscordWrapper(client, channel)
  }

  setActivity(activity: typeof AppStatuses[keyof typeof AppStatuses]) {
    switch (activity) {
      case AppStatuses.SCANNING:
        this.client.user?.setActivity('markets', { type: 'WATCHING' })
        break
      case AppStatuses.SWAPPING:
        this.client.user?.setActivity('swapping SOL for UXD', { type: 'PLAYING' })
        break
      case AppStatuses.REDEEMING:
        this.client.user?.setActivity('redeeming UXD for SOL', { type: 'PLAYING' })
        break
      case AppStatuses.RE_BALANCING:
        this.client.user?.setActivity('re-balancing', { type: 'PLAYING' })
        break
      default:
        console.error('Invalid activity', activity)
    }
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
