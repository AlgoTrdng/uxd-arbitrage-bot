import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const reqString = () => z.string().min(1)

const envSchema = z.object({
  DISCORD_SECRET: reqString(),
  DISCORD_CHANNEL_ID: reqString(),
  TOKEN_SECRET: reqString(),
})

export const secrets = (() => {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    throw result.error
  }
  return result.data as z.infer<typeof envSchema>
})()
