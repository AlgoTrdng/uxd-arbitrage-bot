import {
  Client,
  ColorResolvable,
  EmbedField,
  Intents,
  MessageEmbed,
  TextChannel,
} from 'discord.js'

import config from '../app.config'
import { logger } from '../lib/utils/logger'

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
