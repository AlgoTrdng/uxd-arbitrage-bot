import {
  Connection,
  Transaction,
  TransactionInstruction,
  Keypair,
  TransactionBlockhashCtor,
  PublicKey,
} from '@solana/web3.js'
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

import config from '../../app.config'
import { force } from '../utils/force'

type CreateTransactionConfig = {
  signer: Keypair
  instruction: TransactionInstruction
}

export class UxdWrapper {
  constructor(
    private client: UXDClient,
    private controller: UxdController,
    private mango: UxdMango,
    private depository: UxdMangoDepository,
    private connection: Connection,
  ) {}

  private async createAndSignRawTransaction({ signer, instruction }: CreateTransactionConfig) {
    const {
      blockhash,
      lastValidBlockHeight,
    } = await force(
      () => this.connection.getLatestBlockhash('confirmed'),
      { wait: 200 },
    )

    const transactionConfig: TransactionBlockhashCtor = {
      blockhash,
      lastValidBlockHeight,
    }
    const transaction = new Transaction(transactionConfig)

    transaction.add(instruction)
    transaction.sign(signer)
    return transaction
  }

  async createRedeemRawTransaction(uxdUiBalance: number) {
    const redeemInstruction = this.client.createRedeemFromMangoDepositoryInstruction(
      uxdUiBalance - 1,
      5,
      this.controller,
      this.depository,
      this.mango,
      config.SOL_PUBLIC_KEY,
      {},
    )

    const redeemTransaction = await this.createAndSignRawTransaction({
      signer: config.SOL_PRIVATE_KEY,
      instruction: redeemInstruction,
    })
    return redeemTransaction
  }

  static async init(connection: Connection) {
    const UXD_PROGRAM_PUBLIC_KEY = new PublicKey('UXD8m9cvwk4RcSxnX2HZ9VudQCEeDH6fRnB4CAP57Dr')

    const controller = new Controller('UXD', UXD_DECIMALS, UXD_PROGRAM_PUBLIC_KEY)
    const mango = await createAndInitializeMango(connection, config.cluster as 'mainnet')
    const depository = new MangoDepository(WSOL, 'SOL', SOL_DECIMALS, USDC, 'USDC', USDC_DECIMALS, UXD_PROGRAM_PUBLIC_KEY)
    const client = new UXDClient(UXD_PROGRAM_PUBLIC_KEY)

    return new UxdWrapper(
      client,
      controller,
      mango,
      depository,
      connection,
    )
  }
}
