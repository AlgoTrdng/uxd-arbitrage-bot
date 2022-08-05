import {
  BookSide,
  BookSideLayout,
  Config,
  getPerpMarketByBaseSymbol,
  IDS,
  MangoClient,
} from '@blockworks-foundation/mango-client'

import { connection } from '../config'

export const subscribeToMangoAsks = async () => {
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
  let asks: [number, number][] = []
  connection.onAccountChange(perpMarketConfig.asksKey, (accountInfo) => {
    const bookSide = new BookSide(
      perpMarketConfig.asksKey,
      perpMarket,
      BookSideLayout.decode(accountInfo.data),
    )
    asks = bookSide.getL2Ui(10)
  })

  return () => asks
}
