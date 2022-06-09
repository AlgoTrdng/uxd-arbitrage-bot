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
import { SOL_DECIMALS } from '@uxd-protocol/uxd-client'

const MANGO_GROUP = 'mainnet.1'
const MANGO_RPC = 'https://mango.rpcpool.com/946ef7337da3f5b8d3e4a34e7f88'

type PerpMarketConfig = {
  publicKey: PublicKey
  perpMarket: PerpMarket
}

/**
 * @description [price, bid size (SOL)]
 */
type Asks = [number, number][]

/**
 * @description Fill price and UI amount
 */
type Fills = { price: number; amount: number }[]

export class MangoWrapper {
  connection: Connection
  perpMarketConfig: PerpMarketConfig
  asks: Asks = []

  constructor(connection: Connection, perpMarketConfig: PerpMarketConfig) {
    this.connection = connection
    this.perpMarketConfig = perpMarketConfig
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

    return new MangoWrapper(connection, {
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

  private static getPossibleFills(uxdBalanceUi: number, asks: Asks) {
    let residualBalance = uxdBalanceUi
    const buys: Fills = []

    for (let i = 0; i < asks.length; i += 1) {
      const [price, amount] = asks[i]
      const solAmount = residualBalance / price

      // if solAmount is more than amount, max possible amount is ASK amount
      const totalCost = solAmount > amount
        ? price * amount
        : solAmount * price

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

  /**
   * @returns [AveragePrice, UiAmount]
   */
  private static getFillDetails(buys: Fills): [number, number] {
    const total = buys
      .reduce(
        (_totalCost, { price, amount }) => ({
          cost: _totalCost.cost + price * amount,
          amount: _totalCost.amount + amount,
        }),
        {
          cost: 0,
          amount: 0,
        },
      )

    return [
      total.cost / total.amount,
      Number(total.amount.toFixed(SOL_DECIMALS)),
    ]
  }

  /**
   * @returns [AveragePrice, UiAmount]
   */
  static getSolPerpPrice(uxdBalanceUi: number, asks: Asks) {
    const fills = MangoWrapper.getPossibleFills(uxdBalanceUi, asks)
    const fillDetails = MangoWrapper.getFillDetails(fills)
    return fillDetails
  }
}
