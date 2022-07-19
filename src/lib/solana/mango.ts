import {
  IDS,
  MangoClient,
  Config,
  getMarketByBaseSymbolAndKind,
  BookSide,
  BookSideLayout,
  PerpMarket,
} from '@blockworks-foundation/mango-client'
import { PublicKey, Connection } from '@solana/web3.js'

const MANGO_GROUP = 'mainnet.1'
const MANGO_RPC = 'https://mango.rpcpool.com/946ef7337da3f5b8d3e4a34e7f88'

/**
 * @description [price, bid size (SOL)]
 */
type Orderbook = [number, number][]

type OrderbookKeys = {
  asks: PublicKey
  bids: PublicKey
}

export class MangoWrapper {
  asks: Orderbook = []
  bids: Orderbook = []

  constructor(
    private connection: Connection,
    private perpMarket: PerpMarket,
    private orderbookKeys: OrderbookKeys,
  ) {
    this.watchOrderbook()
  }

  static async init() {
    const connection = new Connection(MANGO_RPC, 'processed')
    const config = new Config(IDS)
    const groupConfig = config.getGroupWithName(MANGO_GROUP)!
    const client = new MangoClient(connection, groupConfig.mangoProgramId)

    const perpMarketConfig = getMarketByBaseSymbolAndKind(groupConfig, 'SOL', 'perp')
    const mangoGroup = await client.getMangoGroup(groupConfig.publicKey)
    const perpMarket = await mangoGroup.loadPerpMarket(
      connection,
      perpMarketConfig.marketIndex,
      perpMarketConfig.baseDecimals,
      perpMarketConfig.quoteDecimals,
    )

    return new MangoWrapper(
      connection,
      perpMarket,
      { asks: perpMarket.asks, bids: perpMarket.bids },
    )
  }

  watchOrderbook() {
    const { asks, bids } = this.orderbookKeys

    this.connection.onAccountChange(asks, (accountInfo) => {
      const _asks = new BookSide(asks, this.perpMarket, BookSideLayout.decode(accountInfo.data))
      this.asks = _asks.getL2Ui(5)
    })
    this.connection.onAccountChange(bids, (accountInfo) => {
      const _bids = new BookSide(bids, this.perpMarket, BookSideLayout.decode(accountInfo.data))
      this.bids = _bids.getL2Ui(5)
    })
  }
}
