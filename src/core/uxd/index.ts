import {
  BookSide,
  BookSideLayout,
  Config,
  getPerpMarketByBaseSymbol,
  IDS,
  MangoClient,
} from '@blockworks-foundation/mango-client'

import { connection } from '../../config'

export type OrderbookSide = 'asks' | 'bids'
export type Order = [number, number]
export type Orderbook = Order[]
export type OrderbookSideGetter = (side: OrderbookSide) => Orderbook

export const subscribeToMangoAsks = async (): Promise<OrderbookSideGetter> => {
  // -----------
  // Init mango
  const config = new Config(IDS)
  const groupConfig = config.getGroupWithName('mainnet.1')

  if (!groupConfig) {
    throw Error('Can not find group config')
  }

  const client = new MangoClient(connection, groupConfig.mangoProgramId)
  const perpMarketConfig = getPerpMarketByBaseSymbol(
    groupConfig,
    'SOL',
  )

  if (!perpMarketConfig) {
    throw Error('Can not find SOL perp market')
  }

  const mangoGroup = await client.getMangoGroup(groupConfig.publicKey)
  const perpMarket = await mangoGroup.loadPerpMarket(
    connection,
    perpMarketConfig?.marketIndex,
    perpMarketConfig?.baseDecimals,
    perpMarketConfig?.quoteDecimals,
  )

  // ---------------------------
  // Subscribe to Mango orderbook
  const orderbook = new Map<OrderbookSide, Orderbook>([
    ['asks', []],
    ['bids', []],
  ])

  connection.onAccountChange(perpMarketConfig.asksKey, (accountInfo) => {
    const bookSide = new BookSide(
      perpMarketConfig.asksKey,
      perpMarket,
      BookSideLayout.decode(accountInfo.data),
    )
    orderbook.set('asks', bookSide.getL2Ui(10))
  })
  connection.onAccountChange(perpMarketConfig.bidsKey, (accountInfo) => {
    const bookSide = new BookSide(
      perpMarketConfig.asksKey,
      perpMarket,
      BookSideLayout.decode(accountInfo.data),
    )
    orderbook.set('bids', bookSide.getL2Ui(10))
  })

  return (side: OrderbookSide) => orderbook.get(side)!
}
