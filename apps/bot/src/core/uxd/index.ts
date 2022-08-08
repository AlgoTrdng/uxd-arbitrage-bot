import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
} from '@solana/spl-token'
import {
  PublicKey, SystemProgram, Transaction, TransactionInstruction,
} from '@solana/web3.js'
import {
  Controller,
  createAndInitializeMango,
  MangoDepository,
  SOL_DECIMALS,
  USDC,
  USDC_DECIMALS,
  UXDClient,
  UXD_DECIMALS,
  WSOL,
} from '@uxd-protocol/uxd-client'

import { connection, walletKeypair } from '../../config'
import { Decimals } from '../../constants'
import { toRaw } from '../../helpers/amount'
import { forceOnError } from '../../helpers/forceOnError'

export const initUxdClient = async () => {
  const UXD_PROGRAM_ID = new PublicKey('UXD8m9cvwk4RcSxnX2HZ9VudQCEeDH6fRnB4CAP57Dr')
  const depository = new MangoDepository(
    WSOL,
    'SOL',
    SOL_DECIMALS,
    USDC,
    'USDC',
    USDC_DECIMALS,
    UXD_PROGRAM_ID,
  )
  const client = new UXDClient(UXD_PROGRAM_ID)
  const controller = new Controller('UXD', UXD_DECIMALS, UXD_PROGRAM_ID)
  const mango = await createAndInitializeMango(
    connection,
    'mainnet',
  )

  return {
    depository,
    client,
    controller,
    mango,
  }
}

export type UxdClient = Awaited<ReturnType<typeof initUxdClient>>

const buildAndSignRawTransaction = async (instructions: TransactionInstruction[]) => {
  const latestBlockHash = await forceOnError(
    () => connection.getLatestBlockhash(),
  )

  const transaction = new Transaction(latestBlockHash)
  transaction.add(...instructions)
  transaction.sign(walletKeypair)

  return transaction
}

const getCollateralATA = (() => {
  let collateralATA: PublicKey | null = null
  return async (depository: MangoDepository) => {
    if (collateralATA) {
      return collateralATA
    }

    collateralATA = await getAssociatedTokenAddress(
      depository.collateralMint,
      walletKeypair.publicKey,
    )
    return collateralATA
  }
})()

const buildCreateCollateralATAInstruction = async (
  collateralATA: PublicKey,
  depository: MangoDepository,
) => {
  const accountInfo = await forceOnError(
    () => connection.getAccountInfo(collateralATA),
  )

  if (!accountInfo?.lamports) {
    const createATAIx = createAssociatedTokenAccountInstruction(
      walletKeypair.publicKey,
      collateralATA,
      walletKeypair.publicKey,
      depository.collateralMint,
    )
    return createATAIx
  }

  return null
}

export const buildMintRawTransaction = async (
  inputAmountUi: number,
  {
    depository,
    controller,
    mango,
    client,
  }: UxdClient,
) => {
  const instructions: TransactionInstruction[] = []

  const collateralATA = await getCollateralATA(depository)
  const createCollateralATAIx = await buildCreateCollateralATAInstruction(
    collateralATA,
    depository,
  )
  if (createCollateralATAIx) {
    instructions.push(createCollateralATAIx)
  }

  instructions.push(
    SystemProgram.transfer({
      fromPubkey: walletKeypair.publicKey,
      toPubkey: collateralATA,
      lamports: toRaw(inputAmountUi, Decimals.SOL),
    }),
    createSyncNativeInstruction(collateralATA),
    await client.createMintWithMangoDepositoryInstruction(
      inputAmountUi,
      5,
      controller,
      depository,
      mango,
      walletKeypair.publicKey,
      {},
    ),
  )

  return buildAndSignRawTransaction(instructions)
}

export const buildRedeemRawTransaction = async (
  inputAmountUi: number,
  {
    depository,
    controller,
    mango,
    client,
  }: UxdClient,
) => {
  const instructions: TransactionInstruction[] = []

  const collateralATA = await getCollateralATA(depository)
  const createCollateralATAIx = await buildCreateCollateralATAInstruction(
    collateralATA,
    depository,
  )
  if (createCollateralATAIx) {
    instructions.push(createCollateralATAIx)
  }

  instructions.push(
    await client.createRedeemFromMangoDepositoryInstruction(
      inputAmountUi,
      5,
      controller,
      depository,
      mango,
      walletKeypair.publicKey,
      {},
    ),
  )

  return buildAndSignRawTransaction(instructions)
}
