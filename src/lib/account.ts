import { Connection, PublicKey } from '@solana/web3.js'

import config from '../app.config'
import { wait } from './utils/wait'

type Balance = number | null

/**
 * @returns Chain amount of SOL
 */
export const fetchLamportsBalance = async (connection: Connection) => {
  let lamports: Balance = null

  while (lamports === null) {
    try {
      lamports = await connection.getBalance(config.SOL_PUBLIC_KEY)
    } catch (error) {
      await wait()
    }
  }

  return lamports
}

/**
 * @returns Chain balance of provided SPL token
 */
export const fetchSplBalance = async (connection: Connection, mintAddress: PublicKey) => {
  let balance: Balance = null

  while (balance === null) {
    try {
      const response = await connection.getParsedTokenAccountsByOwner(config.SOL_PUBLIC_KEY, { mint: mintAddress })
      // Account does not exist, balance = 0
      if (!response.value[0]) {
        balance = 0
        break
      }

      const { amount } = response.value[0].account.data.parsed.info.tokenAmount
      balance = Number(amount)
    } catch (error) {
      await wait()
    }
  }

  return balance
}
