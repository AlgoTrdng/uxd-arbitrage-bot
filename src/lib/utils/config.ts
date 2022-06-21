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

    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    TRADES_COLLECTION: process.env.TRADES_COLLECTION,
  }

  const missingVariables: string[] = []
  Object
    .entries(_envConfig)
    .forEach(([key, value]) => {
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

  defaultUxdUiBalance: number
  maximumUxdUiBalance: number
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
