import { createClient } from 'redis'

import { secrets } from '../config'

const discordAppId = 'uxd-arb'

export const updateStatus = (() => {
  const client = createClient(
    secrets.APP_ENV === 'production'
      ? { url: secrets.REDIS_URL! }
      : undefined,
  )
  let isConnected = false

  return async (type: 'ping' | 'startArb' | 'endArb') => {
    if (!isConnected) {
      await client.connect()
      isConnected = true
    }

    await client.publish('status', JSON.stringify({
      appId: discordAppId,
      type,
    }))
  }
})()
