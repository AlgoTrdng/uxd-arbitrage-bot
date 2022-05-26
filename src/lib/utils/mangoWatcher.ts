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

type Buys = { price: number; amount: number }[]

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

  watchSolPerpAsks() {
    const { publicKey, perpMarket } = this.perpMarketConfig
    this.connection.onAccountChange(publicKey, (accountInfo) => {
      const asks = new BookSide(publicKey, perpMarket, BookSideLayout.decode(accountInfo.data))
      this.asks = asks.getL2Ui(5)
    })
  }

  private static getPossibleBuys(uxdBalance: number, asks: Asks) {
    let residualBalance = uxdBalance
    const buys: Buys = []

    for (let i = 0; i < asks.length; i += 1) {
      const [price, amount] = asks[i]
      const solAmount = residualBalance / price

      // if solAmount is more than amount, max possible amount is ASK amount
      const totalCost = solAmount > amount ? price * amount : solAmount * price

      if (totalCost > residualBalance) {
        buys.push({
          amount: solAmount,
          price,
        })
        break
      }

      residualBalance -= totalCost

      const _amount = totalCost / price
      buys.push({
        amount: _amount,
        price,
      })
    }

    return buys
  }

  private static calculateAveragePrice(buys: Buys) {
    const total = buys.reduce((_totalCost, { price, amount }) => ({
      cost: _totalCost.cost + price * amount,
      amount: _totalCost.amount + amount,
    }), { cost: 0, amount: 0 })
    return total.cost / total.amount
  }

  static getSolPerpPrice(uxdBalance: number, asks: Asks) {
    const buys = MangoWatcher.getPossibleBuys(uxdBalance, asks)
    const price = MangoWatcher.calculateAveragePrice(buys)
    return price
  }
}
