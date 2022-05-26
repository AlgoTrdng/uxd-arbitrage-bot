import { Bot } from './lib/bot'

(async () => {
  try {
    const bot = await Bot.init()
    bot.start()
  } catch (error) {
    console.log(error)
  }
})()
