import { Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'
import fs from 'fs'
import path from 'path'

export type EnvConfig = {
  SOL_RPC_ENDPOINT: string
  SOL_PRIVATE_KEY: Keypair
  SOL_PUBLIC_KEY: PublicKey

  DISCORD_TOKEN: string
  DISCORD_CHANNEL_ID: string

  FIREBASE_API_KEY: string
  FIREBASE_AUTH_DOMAIN: string
  FIREBASE_PROJECT_ID: string
  FIREBASE_STORAGE_BUCKET: string
  FIREBASE_MESSAGING_SENDER_ID: string
  FIREBASE_APP_ID: string

  TRADES_COLLECTION: string
}

export const loadEnvVariables = (envConfig: Record<string, any>) => {
  Object.entries(envConfig).forEach(([key, value]) => {
    if (typeof value !== 'string' || !value.length) {
      throw Error(`Missing ${key} ENV variable`)
    }
  })

  const decodedPrivateKey = bs58.decode(envConfig.SOL_PRIVATE_KEY)
  const keyPair = Keypair.fromSecretKey(decodedPrivateKey)

  return {
    ...envConfig,
    SOL_PRIVATE_KEY: keyPair,
    SOL_PUBLIC_KEY: keyPair.publicKey,
  } as EnvConfig
}

export type AppConfig = {
  cluster: 'mainnet'
  minimumPriceDiff: number
  log: boolean
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
