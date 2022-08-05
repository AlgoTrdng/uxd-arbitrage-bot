import { setTimeout } from 'timers/promises'
import { config } from './config'

import { initJupiter } from './jupiter'
import { subscribeToMangoAsks } from './uxd'

const main = async () => {
  const jupiter = await initJupiter()
  const getAsks = await subscribeToMangoAsks()

  const scanLevelsIncrement = 20
  const scanLevels = Array.from(
    { length: config.MAX_UXD_AMOUNT_UI / scanLevelsIncrement },
    (_, i) => (i + 1) * 20,
  )

  console.log(scanLevels)
  // -------------
  // MAIN BOT LOOP
  while (true) {
    await setTimeout(10_000)
  }
}

main()
