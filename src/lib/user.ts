import { Connection } from '@solana/web3.js'

import config from '../app.config'
import { mint } from './constants'
import { logger } from './utils/logger'

type Balances = {
  USDC: number
  SOL: number
  UXD: number
}

class User {
  connection: Connection

  balances: Balances = { USDC: 0, SOL: 0, UXD: 0 }
  oldBalances: Balances = { USDC: 0, SOL: 0, UXD: 0 }

  constructor(connection: Connection) {
    this.connection = connection
  }

  async fetchAllBalances() {
    await this.fetchLamportsBalances()
    await this.fetchSplBalance('USDC')
    await this.fetchSplBalance('UXD')
  }

  async fetchLamportsBalances() {
    try {
      const lamportsBalance = await this.connection.getBalance(config.SOL_PUBLIC_KEY)

      this.oldBalances = {
        ...this.oldBalances,
        SOL: this.balances.SOL,
      }
      this.balances.SOL = lamportsBalance
    } catch (error) {
      logger('STATUS', 'Can not fetch LAMPORTS balance. Retrying...')
      await this.fetchLamportsBalances()
    }
  }

  async fetchSplBalance(token: 'USDC' | 'UXD') {
    try {
      const response = await this.connection.getParsedTokenAccountsByOwner(config.SOL_PUBLIC_KEY, { mint: mint[token] })
      const { amount } = response.value[0].account.data.parsed.info.tokenAmount

      this.oldBalances = {
        ...this.oldBalances,
        [token]: this.balances[token],
      }
      this.balances[token] = +amount
    } catch (error) {
      logger('STATUS', `Can not fetch ${token} balance. Retrying...`)
      await this.fetchSplBalance(token)
    }
  }
}

export default User
