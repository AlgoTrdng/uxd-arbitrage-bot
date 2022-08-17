import { Connection, Keypair } from '@solana/web3.js'
import dotenv from 'dotenv'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'

import { Decimals } from './constants'
import { toRaw } from './helpers/amount'

dotenv.config()

const requiredString = z.string().min(1)

// -------------------
// Validate ENV config
const ENV_SCHEMA = z.object({
  SOL_RPC_ENDPOINT: requiredString,
  SOL_PRIVATE_KEY: requiredString,

  DISCORD_CHANNEL_ID: requiredString,
  DISCORD_SECRET: requiredString,

  FB_PRIVATE_KEY: requiredString,
  FB_PROJECT_ID: requiredString,
  FB_CLIENT_EMAIL: requiredString,

  STATUS_API: requiredString,
  STATUS_SECRET: requiredString,
})

const {
  SOL_PRIVATE_KEY,
  SOL_RPC_ENDPOINT,
  ...secrets
} = (() => {
  const result = ENV_SCHEMA.safeParse(process.env)

  if (!result.success) {
    throw result.error
  }

  return result.data
})()

export { secrets }

// ---------------------
// Parse app.config.json
const configSchema = z.object({
  minPriceDiff: z.number(),
  minMaPriceDiff: z.number(),
  maxUxdAmountUi: z.number(),
  minUxdAmountUi: z.number(),
  minSolAmountUi: z.number().transform((amount) => toRaw(amount, Decimals.SOL)),
})
type AppConfig = z.infer<typeof configSchema>

const {
  minSolAmountUi: minSolAmountRaw,
  ...appConfig
} = (() => {
  const filePath = path.join(__dirname, '../app.config.json')
  const exists = fs.existsSync(filePath)

  const missingFileError = 'File app.config.js is missing or is empty'
  if (!exists) {
    throw Error(missingFileError)
  }

  const configFileContents = fs.readFileSync(
    filePath,
    { encoding: 'utf-8' },
  )
  if (!configFileContents.length) {
    throw Error(missingFileError)
  }

  const parsed = JSON.parse(configFileContents) as {
    development: AppConfig
    production: AppConfig
  }

  if (!process.env.APP_ENV) {
    throw Error('APP_ENV environment variable was not specified')
  }
  const appEnv = process.env.APP_ENV as 'development' | 'production'

  const result = configSchema.safeParse(parsed[appEnv])
  if (!result.success) {
    throw result.error
  }

  return result.data
})()

const config = {
  ...appConfig,
  minSolAmountRaw,
}
export { config }

export const connection = new Connection(SOL_RPC_ENDPOINT, 'confirmed')

const pkNumArray = SOL_PRIVATE_KEY.split(',').map((x) => Number(x))
const pkBuffer = Buffer.from(new Uint8Array(pkNumArray))
export const walletKeypair = Keypair.fromSecretKey(pkBuffer)
