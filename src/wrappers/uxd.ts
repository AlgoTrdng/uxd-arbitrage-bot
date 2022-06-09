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
import { getChainAmount } from '../lib/utils/amount'

export class UxdWrapper {
  constructor(
    private client: UXDClient,
    private controller: UxdController,
    private mango: UxdMango,
    private depository: UxdMangoDepository,
  ) {}

  createRedeemTransaction(uxdUiBalance: number) {
    const transaction = new Transaction()
    const redeemIx = this.client.createRedeemFromMangoDepositoryInstruction(
      getChainAmount(uxdUiBalance, UXD_DECIMALS),
      5,
      this.controller,
      this.depository,
      this.mango,
      config.SOL_PUBLIC_KEY,
      {},
    )
    transaction.add(redeemIx)
    return transaction
  }

  static async init(connection: Connection) {
    const controller = new Controller('UXD', UXD_DECIMALS, program.UXD)
    const mango = await createAndInitializeMango(connection, config.cluster as 'mainnet')
    const depository = new MangoDepository(WSOL, 'SOL', SOL_DECIMALS, USDC, 'USDC', USDC_DECIMALS, program.UXD)
    const client = new UXDClient(program.UXD)

    return new UxdWrapper(client, controller, mango, depository)
  }
}
