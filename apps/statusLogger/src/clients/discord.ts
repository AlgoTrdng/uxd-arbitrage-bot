import {
  Client,
  EmbedBuilder,
  EmbedField,
  TextChannel,
  GatewayIntentBits,
} from 'discord.js'

import { secrets } from '../config'
import {
  appIds,
  AppStatus,
  state,
  updateWindow,
} from '../state'

const isRunning = (appStatus: AppStatus | undefined | null) => {
  if (!appStatus) {
    return null
  }

  if (appStatus.lastUpdatedMs + updateWindow < new Date().getTime()) {
    return null
  }

  return appStatus
}

const createInlineField = (key: string, val: string) => ({
  name: key,
  value: val,
  inline: true,
})

export const initDiscordAndRegisterCommands = async () => {
  const client = new Client({
    intents: [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages],
  })
  await client.login(secrets.DISCORD_SECRET)

  const channel = await client.channels.fetch(secrets.DISCORD_CHANNEL_ID) as TextChannel | null

  if (!channel) {
    throw Error(`Could not find channel with id: ${secrets.DISCORD_CHANNEL_ID}`)
  }
  console.log('Discord bot logged in')

  // Register messages
  client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!apps')) {
      const embedFields: EmbedField[] = []

      state.forEach((val, key) => {
        if (!isRunning(val)) {
          embedFields.push(createInlineField(key, 'Not running'))
          return
        }

        embedFields.push(createInlineField(key, 'Running'))
      })

      const embed = new EmbedBuilder({
        fields: embedFields,
      })
      await channel.send({ embeds: [embed] })
      return
    }

    if (message.content.startsWith('!status')) {
      const appId = message.content.split(' ')[1]
      const validAppIdsMessage = `Valid app ids are: **${appIds.join(', ')}**.`

      if (!appId) {
        channel.send(`You need to specify appId: !status <appId>. ${validAppIdsMessage}`)
        return
      }

      if (!appIds.includes(appId as typeof appIds[number])) {
        channel.send(`Invalid appId. ${validAppIdsMessage}`)
        return
      }

      const _appId = appId as typeof appIds[number]
      const appStatus = state.get(_appId)

      const validAppStatus = isRunning(appStatus)
      const embed = new EmbedBuilder({
        color: validAppStatus ? 0x78EA4A : 0xEB5757,
        fields: [createInlineField(appId, validAppStatus?.state || 'Not running')],
      })
      await channel.send({ embeds: [embed] })
    }
  })
}
