import { PublicKey } from '@solana/web3.js'

export const mint = {
  SOL: new PublicKey('So11111111111111111111111111111111111111112'),
  USDC: new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  UXD: new PublicKey('7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT'),
} as const

export const MINIMUM_SOL_CHAIN_AMOUNT = 100_000_000 // 0.1 SOL, minimum amount that has to be in wallet
export const MINIMUM_UXD_CHAIN_AMOUNT = 10_000_000 // 10 UXD
