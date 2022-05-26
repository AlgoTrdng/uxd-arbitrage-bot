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

type PerpMarketConfig = {
  publicKey: PublicKey
  perpMarket: PerpMarket
}

/**
 * @description [price, bid size (SOL)]
 */
type Asks = [number, number][]

export class MangoWatcher {
  connection: Connection
  perpMarketConfig: PerpMarketConfig
  asks: Asks = []

  constructor(connection: Connection, perpMarketConfig: PerpMarketConfig) {
    this.connection = connection
    this.perpMarketConfig = perpMarketConfig
  }

  static async init(connection: Connection) {
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

    return new MangoWatcher(connection, {
      publicKey: perpMarketConfig.asksKey,
      perpMarket,
    })
  }

  async watchSolPerpBids() {
    const { publicKey, perpMarket } = this.perpMarketConfig
    this.connection.onAccountChange(publicKey, (accountInfo) => {
      const asks = new BookSide(publicKey, perpMarket, BookSideLayout.decode(accountInfo.data))
      this.asks = asks.getL2Ui(5)
    })
  }
}
