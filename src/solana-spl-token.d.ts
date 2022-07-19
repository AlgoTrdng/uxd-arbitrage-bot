import { PublicKey, TransactionInstruction } from '@solana/web3.js'

declare module '@solana/spl-token' {
  export function getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve?: boolean,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey
  ): Promise<PublicKey>

  export function createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    associatedToken: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey
  ): TransactionInstruction

  function createSyncNativeInstruction(
    account: PublicKey,
    programId?: PublicKey,
  ): TransactionInstruction
}
