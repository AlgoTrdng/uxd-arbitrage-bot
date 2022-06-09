import { Connection, PublicKey } from '@solana/web3.js'
import { AccountLayout } from '@solana/spl-token'

import config from '../app.config'
import { wait } from './utils/wait'

type Balance = number | null

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

      balance = amount
    } catch (error) {
      console.log(error)
      await wait()
    }
  }

  return balance
}

export const watchLamportsBalance = (connection: Connection, publicKey: PublicKey, cb: (amount: number) => void) => {
  connection.onAccountChange(publicKey, (accountInfo) => {
    cb.call(null, accountInfo.lamports)
  })
}

export const watchSplBalance = (connection: Connection, publicKey: PublicKey, cb: (amount: number) => void) => {
  connection.onAccountChange(publicKey, (accountInfo) => {
    try {
      const decodedData = AccountLayout.decode(accountInfo.data)
      cb.call(null, decodedData.amount)
    } catch (error) {
      console.log(error, accountInfo)
      throw Error('Error with decoding spl data')
    }
  })
}
