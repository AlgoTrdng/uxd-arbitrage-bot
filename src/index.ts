import { Bot } from './lib/bot'

(async () => {
  try {
    const bot = await Bot.init()
    bot.startWatchingForArbitrage()
  } catch (error) {
    console.log(error)
  }
})()
