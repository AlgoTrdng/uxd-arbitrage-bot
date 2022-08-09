import { initDiscordAndRegisterCommands } from './clients/discord'
import { app } from './clients/fastify'
import './routes/status'

const appEnv = process.env.APP_ENV as 'development' | 'production'
if (!appEnv) {
  throw Error('APP_ENV was not specified')
}

(async () => {
  await initDiscordAndRegisterCommands()

  app.listen({
    port: Number(process.env.PORT) || 3122,
    host: appEnv === 'development' ? '127.0.0.1' : '0.0.0.0',
  }, (err, address) => {
    if (err) {
      throw err
    }

    console.log(`Listening on: ${address}`)
  })
})()
