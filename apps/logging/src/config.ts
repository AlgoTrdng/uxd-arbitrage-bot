import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  DISCORD_SECRET: z.string().min(1),
  DISCORD_CHANNEL_ID: z.string().min(1),
  FB_PROJECT_ID: z.string().min(1),
  FB_PRIVATE_KEY: z.string().min(1),
  FB_CLIENT_EMAIL: z.string().min(1),
  TOKEN_SECRET: z.string().min(1),
})

export const secrets = (() => {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    throw result.error
  }
  return result.data as z.infer<typeof envSchema>
})()
