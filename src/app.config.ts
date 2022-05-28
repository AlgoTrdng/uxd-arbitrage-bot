import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import dotenv from 'dotenv'

import { EnvConfig, Config } from './lib/types/config'
import { validateEnv } from './lib/utils/validateEnv'

dotenv.config()

const {
  SOL_PRIVATE_KEY,
  SOL_RPC_ENDPOINT,
  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
} = process.env as EnvConfig

validateEnv(SOL_PRIVATE_KEY, SOL_RPC_ENDPOINT, DISCORD_CHANNEL_ID, DISCORD_TOKEN)

const decodedPrivateKey = bs58.decode(SOL_PRIVATE_KEY)
const keyPair = Keypair.fromSecretKey(decodedPrivateKey)

const config: Config = {
  CLUSTER: 'mainnet',
  MIN_ARB_PERCENTAGE: 0.2,
  LOG: true,

  SOLANA_RPC_ENDPOINT: SOL_RPC_ENDPOINT,
  SOL_PUBLIC_KEY: keyPair.publicKey,
  SOL_PRIVATE_KEY: keyPair,

  DISCORD_TOKEN,
  DISCORD_CHANNEL_ID,
}

export default config
