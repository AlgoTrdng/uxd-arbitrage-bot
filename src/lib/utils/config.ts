import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

export const loadEnvVariables = () => {
  const _envConfig = {
    SOL_RPC_ENDPOINT: process.env.SOL_RPC_ENDPOINT,
    SOL_PRIVATE_KEY: process.env.SOL_PRIVATE_KEY,

    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_CHANNEL_ID: process.env.DISCORD_CHANNEL_ID,
    DISCORD_BOT_USER_ID: process.env.DISCORD_BOT_USER_ID,

    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
    FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,

    TRADES_COLLECTION: process.env.TRADES_COLLECTION,
  }

  const missingVariables: string[] = []
  Object.entries(_envConfig).forEach(([key, value]) => {
    if (typeof value !== 'string' || !value.length) {
      missingVariables.push(key)
    }
  })

  if (missingVariables.length) {
    throw Error(`Missing ENV variables: ${missingVariables.join(' ,')}`)
  }

  return _envConfig as Record<keyof typeof _envConfig, string>
}

type AppConfig = {
  cluster: 'mainnet'
  minimumPriceDiff: number
  log: boolean

  defaultUxdBalance: number
  maximumUxdBalance: number
}

export const loadAppConfig = () => {
  try {
    const configPath = path.join(__dirname, '../../../app.config.json')
    const configFile = fs.readFileSync(configPath, { encoding: 'utf-8' })
    const config = JSON.parse(configFile)
    return config as AppConfig
  } catch (error) {
    throw Error('Can not load config file')
  }
}
