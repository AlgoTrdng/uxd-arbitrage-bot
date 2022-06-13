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

import config from '../app.config'
import { program } from '../constants'

const createTransaction = async (
  connection: Connection,
  signer: Keypair,
  instruction: TransactionInstruction,
) => {
  let validUntil: null | number = null

  const update = async () => {
    const { blockhash: latestBlockHash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    validUntil = lastValidBlockHeight

    const transactionConfig: TransactionBlockhashCtor = {
      blockhash: latestBlockHash,
      lastValidBlockHeight,
    }
    const transaction = new Transaction(transactionConfig)

    transaction.add(instruction)
    transaction.sign(signer)
    const serializedTransaction = transaction.serialize()
    return serializedTransaction
  }

  /**
   * @returns True if is valid
   */
  const validate = async () => {
    if (!validUntil) {
      return false
    }

    const blockHeight = await connection.getBlockHeight('confirmed')
    return validUntil > blockHeight
  }

  const transaction = await update()

  return {
    transaction,
    update,
    validate,
  }
}

export class UxdWrapper {
  constructor(
    private client: UXDClient,
    private controller: UxdController,
    private mango: UxdMango,
    private depository: UxdMangoDepository,
    private connection: Connection,
  ) {}

  async createSignedRedeemRawTransaction(uxdUiBalance: number) {
    const redeemInstruction = this.client.createRedeemFromMangoDepositoryInstruction(
      uxdUiBalance - 1,
      5,
      this.controller,
      this.depository,
      this.mango,
      config.SOL_PUBLIC_KEY,
      {},
    )
    const transactionData = await createTransaction(this.connection, config.SOL_PRIVATE_KEY, redeemInstruction)
    return transactionData
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
