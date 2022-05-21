import { PublicKey, Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import dotenv from 'dotenv'

import { EnvConfig, Config } from './lib/types/config'

dotenv.config()

const {
  SOL_PRIVATE_KEY, DISCORD_TOKEN, SOL_PUBLIC_KEY, DISCORD_CHANNEL,
} = process.env as EnvConfig

if ([SOL_PRIVATE_KEY, DISCORD_TOKEN, SOL_PUBLIC_KEY, DISCORD_CHANNEL].some((envVar) => typeof envVar !== 'string')) {
  throw new Error('Missing ENV variable!')
}

const decodedPrivateKey = bs58.decode(SOL_PRIVATE_KEY)
const keyPair = Keypair.fromSecretKey(decodedPrivateKey)

const config: Config = {
  SOLANA_RPC_ENDPOINT: '',
  CLUSTER: 'mainnet',
  MIN_ARB_PERCENTAGE: 0,
  LOG: true,

  SOL_PUBLIC_KEY: new PublicKey(SOL_PUBLIC_KEY),
  SOL_PRIVATE_KEY: keyPair,

  DISCORD_TOKEN,
  DISCORD_CHANNEL,
}

export default config
