import { PublicKey } from '@solana/web3.js'

export const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112')
export const UXD_MINT = new PublicKey('7kbnvuGBxxj8AG9qp8Scn56muWGaRaFqxg1FsRp3PaFT')
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')

export const Decimals = {
  USD: 6,
  SOL: 9,
} as const
