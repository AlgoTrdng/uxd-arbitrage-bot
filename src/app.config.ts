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
} = process.env

const envConfig = loadEnvVariables({
  SOL_PRIVATE_KEY, SOL_RPC_ENDPOINT, DISCORD_TOKEN, DISCORD_CHANNEL_ID,
})
const appConfig = loadAppConfig()

const config: AppConfig & EnvConfig = {
  ...envConfig,
  ...appConfig,
}

export default config
