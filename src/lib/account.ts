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
      console.log(error)
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
      // Account does not exist
      if (!response.value[0]) {
        continue
      }
      const { amount } = response.value[0].account.data.parsed.info.tokenAmount

      balance = Number(amount)
    } catch (error) {
      console.log(error)
      await wait()
    }
  }

  return balance
}

export const watchSolBalance = (connection: Connection, cb: (chainAmount: number) => void) => {
  setInterval(async () => {
    const solBalance = await fetchLamportsBalance(connection)
    cb.call(null, solBalance)
  }, 30_000)
}
