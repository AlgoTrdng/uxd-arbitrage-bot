import { setTimeout } from 'timers/promises'
import { initPriceDiffsMAs, updatePriceDiffsAndFindArb } from './core/priceDiffs'

import { Directions, initJupiter } from './core/jupiter'
import { subscribeToMangoAsks } from './core/uxd'
import { fetchCoingeckoSolPrice } from './core/coingecko'

const main = async () => {
  const jupiter = await initJupiter()
  const getOrderbookSide = await subscribeToMangoAsks()

  // -------------
  // MAIN BOT LOOP
  const priceDiffs = initPriceDiffsMAs()

  while (true) {
    await setTimeout(10_000)
    const arbOpportunity = await updatePriceDiffsAndFindArb({
      jupiter,
      priceDiffsMAs: priceDiffs,
      getOrderbookSide,
    })

    if (!arbOpportunity) {
      continue
    }

    const { inputAmountUi, direction } = arbOpportunity

    switch (direction) {
      case Directions.MINT: {
        const coingeckoSolPrice = await fetchCoingeckoSolPrice()
        if (!coingeckoSolPrice) {
          break
        }

        const solInputAmount = inputAmountUi / coingeckoSolPrice

        break
      }
      case Directions.REDEMPTION: {
        break
      }
      default: throw Error(`Unknown arb direction: ${direction}`)
    }
  }
}

main()
