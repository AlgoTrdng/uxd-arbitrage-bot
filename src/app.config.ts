import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import dotenv from 'dotenv'

dotenv.config()

const SECRETS = (() => {
  const envVariables = [
    // Secrets
    'SOL_RPC_ENDPOINT',
    'SOL_PRIVATE_KEY',
    'DISCORD_TOKEN',
    'DISCORD_CHANNEL_ID',
    'FIREBASE_PROJECT_ID',
    'TRADES_COLLECTION',
    // Firebase admin
    'FB_project_id',
    'FB_private_key',
    'FB_client_email',
    // Config
    'MINIMUM_PRICE_DIFF',
    'CLUSTER',
    'SIZE_DECREMENT_STEP',
    'DEFAULT_UXD_UI_BALANCE',
    'MAXIMUM_UXD_UI_BALANCE',
  ] as const

  const secrets = {} as { [K in typeof envVariables[number]]: string }
  const missingVariables: string[] = []
  envVariables.forEach((envVariable) => {
    if (!(envVariable in process.env) || !process.env[envVariable]!.length) {
      missingVariables.push(envVariable)
      return
    }

    secrets[envVariable] = process.env[envVariable]!
  })

  if (missingVariables.length) {
    throw Error(`Missing ENV variables: ${missingVariables.join(' ,')}`)
  }

  return secrets
})()

const {
  SOL_PRIVATE_KEY,
  MINIMUM_PRICE_DIFF,
  CLUSTER,
  SIZE_DECREMENT_STEP,
  DEFAULT_UXD_UI_BALANCE,
  MAXIMUM_UXD_UI_BALANCE,
  ...envConfig
} = SECRETS

const decodedPrivateKey = bs58.decode(SOL_PRIVATE_KEY)
const keyPair = Keypair.fromSecretKey(decodedPrivateKey)

const config = {
  ...envConfig,
  SOL_PRIVATE_KEY: keyPair,
  SOL_PUBLIC_KEY: keyPair.publicKey,

  minimumPriceDiff: Number(MINIMUM_PRICE_DIFF),
  sizeDecrementStep: Number(SIZE_DECREMENT_STEP),
  defaultUxdUiBalance: Number(DEFAULT_UXD_UI_BALANCE),
  maximumUxdUiBalance: Number(MAXIMUM_UXD_UI_BALANCE),
  cluster: CLUSTER,
} as const

export default config
