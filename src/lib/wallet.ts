import { Connection, PublicKey } from '@solana/web3.js'
// Using @ts-ignore because importing `getAssociatedTokenAddress` and `closeAccount` is throwing an error that it is not exported
// @ts-ignore
import { NATIVE_MINT, getAssociatedTokenAddress, closeAccount } from '@solana/spl-token'
import { SOL_DECIMALS, UXD_DECIMALS } from '@uxd-protocol/uxd-client'

import { CloseAccountReturnType } from './types/splToken'
import config from '../app.config'
import { mint } from './constants'

const decimals = {
  SOL: SOL_DECIMALS,
  UXD: UXD_DECIMALS,
}

export class Wallet {
  connection: Connection

  lamportsBalance = 0
  uxdBalance = 0
  wrappedLamportsBalance = 0

  static wrappedSolAddress: PublicKey | null = null

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

  private async fetchSplBalance(mintAddress: PublicKey): Promise<number> {
    try {
      const response = await this.connection.getParsedTokenAccountsByOwner(config.SOL_PUBLIC_KEY, { mint: mintAddress })

      // Account does not exist
      if (!response.value[0]) {
        return 0
      }

      const { amount } = response.value[0].account.data.parsed.info.tokenAmount
      return amount as number
    } catch (error) {
      return this.fetchSplBalance(mintAddress)
    }
  }

  /**
   * @description Fetches UXD balance
   * @returns UXD balance pre-fetch
   */
  async fetchUxdBalance(): Promise<number> {
    const amount = await this.fetchSplBalance(mint.UXD)
    const oldBalance = this.uxdBalance
    this.uxdBalance = amount

    return oldBalance
  }

  async fetchWrappedLamportsBalance(): Promise<number> {
    const amount = await this.fetchSplBalance(mint.SOL)
    const oldBalance = this.wrappedLamportsBalance
    this.wrappedLamportsBalance = amount

    return oldBalance
  }

  static getUiBalance(balance: number, token: keyof typeof decimals) {
    return balance / (10 ** decimals[token])
  }

  static async getWrappedSolPublicKey() {
    if (Wallet.wrappedSolAddress) {
      return Wallet.wrappedSolAddress
    }

    const wrappedSoLPublicKey = await getAssociatedTokenAddress(
      NATIVE_MINT,
      config.SOL_PUBLIC_KEY,
    ) as PublicKey
    Wallet.wrappedSolAddress = wrappedSoLPublicKey
    return wrappedSoLPublicKey
  }

  async closeWrappedSolAccount() {
    console.log('Closing WSOL Account')
    const wrappedSoLPublicKey = await Wallet.getWrappedSolPublicKey()
    try {
      return closeAccount(
        this.connection,
        config.SOL_PRIVATE_KEY,
        wrappedSoLPublicKey,
        config.SOL_PUBLIC_KEY,
        config.SOL_PRIVATE_KEY,
      ) as CloseAccountReturnType
    } catch (error) {
      return null
    }
  }
}
