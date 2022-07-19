import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
} from '@solana/spl-token'
import {
  Connection,
  Transaction,
  TransactionInstruction,
  Keypair,
  PublicKey,
  SystemProgram,
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
import { getChainAmount } from '../utils/amount'
import { forceOnError } from '../utils/force'

type CreateTransactionConfig = {
  signer: Keypair
  instructions: TransactionInstruction[]
}

export class UxdWrapper {
  constructor(
    private client: UXDClient,
    private controller: UxdController,
    private mango: UxdMango,
    private depository: UxdMangoDepository,
    private connection: Connection,
  ) {}

  private async getCreateCollateralATAInstruction(): Promise<[TransactionInstruction | null, PublicKey]> {
    const collateralATA = await getAssociatedTokenAddress(
      this.depository.collateralMint,
      config.SOL_PUBLIC_KEY,
    )
    const collateralATAInfo = await this.connection.getAccountInfo(collateralATA)

    if (!collateralATAInfo?.lamports) {
      const ix = createAssociatedTokenAccountInstruction(
        config.SOL_PUBLIC_KEY,
        collateralATA,
        config.SOL_PUBLIC_KEY,
        this.depository.collateralMint,
      )
      return [ix, collateralATA]
    }

    return [null, collateralATA]
  }

  private async createAndSignRawTransaction({ signer, instructions }: CreateTransactionConfig) {
    const {
      blockhash,
      lastValidBlockHeight,
    } = await forceOnError(() => this.connection.getLatestBlockhash('confirmed'))

    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
    })

    transaction.add(...instructions)
    transaction.sign(signer)
    return transaction
  }

  async createRedeemRawTransaction(uxdUiBalance: number) {
    const instructions: TransactionInstruction[] = []

    const [createATAInstruction] = await this.getCreateCollateralATAInstruction()
    if (createATAInstruction) {
      instructions.push(createATAInstruction)
    }

    const redeemInstruction = await this.client.createRedeemFromMangoDepositoryInstruction(
      uxdUiBalance - 1,
      5,
      this.controller,
      this.depository,
      this.mango,
      config.SOL_PUBLIC_KEY,
      {},
    )
    instructions.push(redeemInstruction)

    const redeemTransaction = await this.createAndSignRawTransaction({
      signer: config.SOL_PRIVATE_KEY,
      instructions,
    })
    return redeemTransaction
  }

  async createMintRawTransaction(solUiBalance: number) {
    const instructions: TransactionInstruction[] = []

    const [createATAInstruction, ata] = await this.getCreateCollateralATAInstruction()
    if (createATAInstruction) {
      instructions.push(createATAInstruction)
    }

    const transferSolInstruction = SystemProgram.transfer({
      fromPubkey: config.SOL_PUBLIC_KEY,
      toPubkey: ata,
      lamports: getChainAmount(solUiBalance, SOL_DECIMALS),
    })
    const syncNativeInstruction = createSyncNativeInstruction(ata)
    instructions.push(
      transferSolInstruction,
      syncNativeInstruction,
    )

    const mintInstruction = await this.client.createMintWithMangoDepositoryInstruction(
      solUiBalance,
      5,
      this.controller,
      this.depository,
      this.mango,
      config.SOL_PUBLIC_KEY,
      {},
    )
    instructions.push(mintInstruction)

    const mintTransaction = await this.createAndSignRawTransaction({
      signer: config.SOL_PRIVATE_KEY,
      instructions,
    })
    return mintTransaction
  }

  static async init(connection: Connection) {
    const UXD_PROGRAM_PUBLIC_KEY = new PublicKey('UXD8m9cvwk4RcSxnX2HZ9VudQCEeDH6fRnB4CAP57Dr')

    const controller = new Controller(
      'UXD',
      UXD_DECIMALS,
      UXD_PROGRAM_PUBLIC_KEY,
    )
    const mango = await createAndInitializeMango(
      connection,
      config.cluster as 'mainnet',
    )
    const depository = new MangoDepository(
      WSOL,
      'SOL',
      SOL_DECIMALS,
      USDC,
      'USDC',
      USDC_DECIMALS,
      UXD_PROGRAM_PUBLIC_KEY,
    )
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

(async () => {
  const connection = new Connection(config.SOL_RPC_ENDPOINT)
  const uxdClient = await UxdWrapper.init(connection)
  const tx = await uxdClient.createMintRawTransaction(0.4895123)
})()
