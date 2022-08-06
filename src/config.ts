import { Connection, Keypair } from '@solana/web3.js'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const ENV_SCHEMA = z.object({
  SOL_RPC_ENDPOINT: z.string().min(1),
  SOL_PRIVATE_KEY: z.string().min(1),

  MAX_UXD_AMOUNT_UI: z.string().regex(/[0-9]/g).transform((amount) => Number(amount)),
  MIN_UXD_AMOUNT_UI: z.string().regex(/[0-9]/g).transform((amount) => Number(amount)),
})

// Validate ENV config
const {
  SOL_PRIVATE_KEY,
  SOL_RPC_ENDPOINT,
  ...config
} = (() => {
  const result = ENV_SCHEMA.safeParse(process.env)

  if (!result.success) {
    throw result.error
  }

  return result.data as z.infer<typeof ENV_SCHEMA>
})()

export { config }

export const connection = new Connection(SOL_RPC_ENDPOINT, 'confirmed')

const pkNumArray = SOL_PRIVATE_KEY.split(',').map((x) => Number(x))
const pkBuffer = Buffer.from(new Uint8Array(pkNumArray))
export const walletKeypair = Keypair.fromSecretKey(pkBuffer)

export const MIN_PRICE_DIFF = 0.15
export const MIN_MA_PRICE_DIFF = 0.05
