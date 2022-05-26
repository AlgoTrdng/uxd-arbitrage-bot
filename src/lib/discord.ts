import {
  Client, Intents, MessageEmbed, TextChannel,
} from 'discord.js'

import config from '../app.config'
import { logger } from './utils/logger'

export class Discord {
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
    await channel.send('Arbitrage bot started, SETUP ready, scanning for arbitrage.')

    return new Discord(client, channel)
  }

  async sendArbMsg(amounts: { oldUxdUiAmount: number, newUxdUiAmount: number }, success: boolean) {
    const { oldUxdUiAmount, newUxdUiAmount } = amounts
    const profit = (newUxdUiAmount / oldUxdUiAmount - 1) * 100
    const description = success
      ? 'Successfully executed **REDEEM** arbitrage'
      : 'Unsuccessfully executed **REDEEM** arbitrage, redemption failed'
    const embed = new MessageEmbed({
      description,
      fields: [
        {
          name: 'Old amount',
          value: `UXD ${oldUxdUiAmount.toFixed(2)}`,
          inline: true,
        },
        {
          name: 'New amount',
          value: `UXD ${newUxdUiAmount.toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Profit',
          value: `${profit.toFixed(2)}%`,
          inline: true,
        },
      ],
    })
    const clr = profit > 0 ? '#78EA4A' : '#EB5757'
    embed.setColor(clr)

    await this.channel?.send({ embeds: [embed] })
  }
}
