import { Connection } from '@solana/web3.js'
import { UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import config from '../app.config'
import { mint } from './constants'
import { logger } from './utils/logger'

export class Wallet {
  connection: Connection

  uxdBalance: number = 0
  uxdOldBalance: number = 0

  constructor(connection: Connection) {
    this.connection = connection
  }

  async fetchUxdBalance() {
    try {
      const response = await this.connection.getParsedTokenAccountsByOwner(config.SOL_PUBLIC_KEY, { mint: mint.UXD })
      const { amount } = response.value[0].account.data.parsed.info.tokenAmount

      this.uxdOldBalance = this.uxdBalance
      this.uxdBalance = +amount
    } catch (error) {
      logger('STATUS', 'Can not fetch UXD balance. Retrying...')
      await this.fetchUxdBalance()
    }
  }

  static getUiBalance(balance: number) {
    return balance / (10 ** UXD_DECIMALS)
  }
}
