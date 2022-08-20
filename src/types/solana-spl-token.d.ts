import {
  PublicKey,
  Struct,
  TransactionInstruction,
  Signer,
  Connection,
  TransactionSignature,
  ConfirmOptions,
} from '@solana/web3.js'

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

  export function createSyncNativeInstruction(
    account: PublicKey,
    programId?: PublicKey,
  ): TransactionInstruction

  // eslint-disable-next-line no-shadow
  export enum AccountState {
    Uninitialized = 0,
    Initialized = 1,
    Frozen = 2,
  }

  export type RawAccount = {
    mint: PublicKey;
    owner: PublicKey;
    amount: bigint;
    delegateOption: 1 | 0;
    delegate: PublicKey;
    state: AccountState;
    isNativeOption: 1 | 0;
    isNative: bigint;
    delegatedAmount: bigint;
    closeAuthorityOption: 1 | 0;
    closeAuthority: PublicKey;
  }

  export type AccountLayout = Struct<RawAccount>

  export function getAssociatedTokenAddressSync(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve?: boolean,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey,
  ): PublicKey

  export function closeAccount(
    connection: Connection,
    payer: Signer,
    account: PublicKey,
    destination: PublicKey,
    authority: Signer | PublicKey,
    multiSigners?: Signer[],
    confirmOptions?: ConfirmOptions,
    programId?: PublicKey,
): Promise<TransactionSignature>
}
