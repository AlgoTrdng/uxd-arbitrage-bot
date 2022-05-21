import {
  Client, Intents, MessageEmbed, TextChannel,
} from 'discord.js'

import config from '../app.config'
import { logger } from './utils/logger'

class Discord {
  client = new Client({ intents: [Intents.FLAGS.DIRECT_MESSAGES] })
  channel: TextChannel | null = null

  async init() {
    this.client.on('ready', () => {
      logger('STATUS', 'Discord client ready!')
    })

    await this.client.login(config.DISCORD_TOKEN)
    this.channel = await this.client.channels.fetch(config.DISCORD_CHANNEL) as TextChannel

    await this.channel.send('Arbitrage bot started, SETUP ready, scanning for arbitrage.')
  }

  async sendArbNotification(amounts: { oldUxdUiAmount: number, newUxdUiAmount: number }) {
    const { oldUxdUiAmount, newUxdUiAmount } = amounts
    const profit = (newUxdUiAmount / oldUxdUiAmount - 1) * 100
    const embed = new MessageEmbed({
      description: 'Executed **REDEEM** arbitrage',
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

export default Discord
