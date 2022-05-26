import { Keypair, PublicKey } from '@solana/web3.js'

export type Config = {
  SOLANA_RPC_ENDPOINT: string
  CLUSTER: 'mainnet'
  MIN_ARB_PERCENTAGE: number
  LOG: boolean

  SOL_PRIVATE_KEY: Keypair
  SOL_PUBLIC_KEY: PublicKey

  DISCORD_TOKEN: string
  DISCORD_CHANNEL_ID: string
}

export type EnvConfig = {
  SOL_RPC_ENDPOINT: string
  SOL_PRIVATE_KEY: string
  SOL_PUBLIC_KEY: string
  DISCORD_TOKEN: string
  DISCORD_CHANNEL_ID: string
}
