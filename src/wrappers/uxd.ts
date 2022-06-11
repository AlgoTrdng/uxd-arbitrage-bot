import { Connection, Transaction } from '@solana/web3.js'
import {
  Controller,
  Controller as UxdController,
  createAndInitializeMango,
  Mango as UxdMango,
  MangoDepository,
  MangoDepository as UxdMangoDepository,
  SOL_DECIMALS,
  USDC,
  USDC_DECIMALS,
  UXDClient,
  UXD_DECIMALS,
  WSOL,
} from '@uxd-protocol/uxd-client'

import config from '../app.config'
import { program } from '../constants'

export class UxdWrapper {
  constructor(
    private client: UXDClient,
    private controller: UxdController,
    private mango: UxdMango,
    private depository: UxdMangoDepository,
    private connection: Connection,
  ) {}

  async createSignedRedeemRawTransaction(uxdUiBalance: number) {
    const { blockhash } = await this.connection.getLatestBlockhash('confirmed')

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: config.SOL_PUBLIC_KEY,
    })
    const redeemIx = this.client.createRedeemFromMangoDepositoryInstruction(
      uxdUiBalance,
      5,
      this.controller,
      this.depository,
      this.mango,
      config.SOL_PUBLIC_KEY,
      {},
    )
    transaction.add(redeemIx)
    transaction.sign(config.SOL_PRIVATE_KEY)
    const signedTransaction = transaction.serialize()
    return signedTransaction
  }

  static async init(connection: Connection) {
    const controller = new Controller('UXD', UXD_DECIMALS, program.UXD)
    const mango = await createAndInitializeMango(connection, config.cluster as 'mainnet')
    const depository = new MangoDepository(WSOL, 'SOL', SOL_DECIMALS, USDC, 'USDC', USDC_DECIMALS, program.UXD)
    const client = new UXDClient(program.UXD)

    return new UxdWrapper(
      client,
      controller,
      mango,
      depository,
      connection,
    )
  }
}
