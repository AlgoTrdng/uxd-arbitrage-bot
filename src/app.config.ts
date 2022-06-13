import dotenv from 'dotenv'

import {
  loadEnvVariables,
  loadAppConfig,
  AppConfig,
  EnvConfig,
} from './lib/utils/config'

dotenv.config()

const {
  SOL_PRIVATE_KEY,
  SOL_RPC_ENDPOINT,
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  TRADES_COLLECTION,
  REDEMPTION_FAILS_COLLECTION,
} = process.env

const envConfig = loadEnvVariables({
  SOL_PRIVATE_KEY,
  SOL_RPC_ENDPOINT,
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  TRADES_COLLECTION,
  REDEMPTION_FAILS_COLLECTION,
})
const appConfig = loadAppConfig()

const config: AppConfig & EnvConfig = {
  ...envConfig,
  ...appConfig,
}

export default config
