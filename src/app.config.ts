import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'

import {
  loadEnvVariables,
  loadAppConfig,
} from './lib/utils/config'

const { SOL_PRIVATE_KEY, ...envConfig } = loadEnvVariables()
const appConfig = loadAppConfig()

const decodedPrivateKey = bs58.decode(SOL_PRIVATE_KEY)
const keyPair = Keypair.fromSecretKey(decodedPrivateKey)

const config = {
  ...envConfig,
  ...appConfig,
  SOL_PRIVATE_KEY: keyPair,
  SOL_PUBLIC_KEY: keyPair.publicKey,
} as const

export default config
