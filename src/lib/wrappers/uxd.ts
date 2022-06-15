import {
  Connection,
  Transaction,
  TransactionInstruction,
  Keypair,
  TransactionBlockhashCtor,
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
import { program } from '../../constants'
import { force } from '../utils/force'

const createTransaction = async (
  connection: Connection,
  signer: Keypair,
  instruction: TransactionInstruction,
) => {
  const {
    blockhash,
    lastValidBlockHeight,
  } = await force(() => {
    console.log('Fetching blockHash')
    return connection.getLatestBlockhash('confirmed')
  }, { wait: 200 })

  const transactionConfig: TransactionBlockhashCtor = {
    blockhash,
    lastValidBlockHeight,
  }
  const transaction = new Transaction(transactionConfig)

  transaction.add(instruction)
  transaction.sign(signer)
  return transaction
}

export class UxdWrapper {
  constructor(
    private client: UXDClient,
    private controller: UxdController,
    private mango: UxdMango,
    private depository: UxdMangoDepository,
    private connection: Connection,
  ) {}

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
    const redeemTransaction = await createTransaction(this.connection, config.SOL_PRIVATE_KEY, redeemInstruction)
    return redeemTransaction
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
