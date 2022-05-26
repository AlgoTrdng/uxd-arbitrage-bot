import { Connection } from '@solana/web3.js'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import config from '../app.config'
import { mint } from './constants'
import { logger } from './utils/logger'

const decimals = {
  SOL: SOL_DECIMALS,
  UXD: UXD_DECIMALS,
}

export class Wallet {
  connection: Connection

  lamportsBalance = 0
  uxdBalance = 0

  static async init(connection: Connection) {
    const wallet = new Wallet(connection)
    await wallet.fetchUxdBalance()
    await wallet.fetchLamportsBalance()
    return wallet
  }

  constructor(connection: Connection) {
    this.connection = connection
  }

  /**
   * @description Fetches lamports balance
   * @returns Lamports balance pre-fetch
   */
  async fetchLamportsBalance(): Promise<number> {
    try {
      const oldBalance = this.lamportsBalance
      const lamports = await this.connection.getBalance(config.SOL_PUBLIC_KEY)
      this.lamportsBalance = lamports

      return oldBalance
    } catch (error) {
      return this.fetchLamportsBalance()
    }
  }

  /**
   * @description Fetches UXD balance
   * @returns UXD balance pre-fetch
   */
  async fetchUxdBalance(): Promise<number> {
    try {
      const response = await this.connection.getParsedTokenAccountsByOwner(config.SOL_PUBLIC_KEY, { mint: mint.UXD })
      const { amount } = response.value[0].account.data.parsed.info.tokenAmount

      const oldBalance = this.uxdBalance
      this.uxdBalance = +amount

      return oldBalance
    } catch (error) {
      logger('STATUS', 'Can not fetch UXD balance. Retrying...')
      return this.fetchUxdBalance()
    }
  }

  static getUiBalance(balance: number, token: keyof typeof decimals) {
    return balance / (10 ** decimals[token])
  }
}
