import {
  Client,
  EmbedField,
  Intents,
  MessageEmbed,
  TextChannel,
} from 'discord.js'

import config from '../../../app.config'
import { AppStatus, AppStatuses, ArbitrageType } from '../../../state'

export type ArbitrageMessageConfig = {
  oldAmount: number
  newAmount: number
  profitPercentage: number
  type: ArbitrageType
}

export type ReBalanceMessageConfig = {
  oldAmount: number
  newAmount: number
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

  setActivity(activity: AppStatus) {
    switch (activity) {
      case AppStatuses.SCANNING:
        this.client.user?.setActivity('markets', { type: 'WATCHING' })
        break
      case AppStatuses.MINTING:
      case AppStatuses.REDEEMING:
        this.client.user?.setActivity('arbitrage', { type: 'PLAYING' })
        break
      case AppStatuses.RE_BALANCING:
        this.client.user?.setActivity('re-balancing', { type: 'PLAYING' })
        break
      default:
        throw new Error(`Invalid activity: ${activity}`)
    }
  }

  async sendArbitrageMessage({
    oldAmount,
    newAmount,
    profitPercentage,
    type,
  }: ArbitrageMessageConfig) {
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
    const clr = profitPercentage > 0 ? '#78EA4A' : '#EB5757'

    const embed = new MessageEmbed({
      description: `Executed **${type}** arbitrage`,
      fields,
    })
    embed.setColor(clr)

    await this.channel.send({ embeds: [embed] })
  }

  async sendReBalanceMessage(reBalanceConfig: ReBalanceMessageConfig) {
    const { oldAmount, newAmount } = reBalanceConfig

    const embedFields: EmbedField[] = [
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
    ]

    const embed = new MessageEmbed({
      description: 'Successfully swapped UXD to USDC',
      fields: embedFields,
    })
    embed.setColor('#FFAA2B')

    await this.channel.send({ embeds: [embed] })
  }
}
