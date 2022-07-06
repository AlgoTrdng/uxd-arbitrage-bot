import { Connection, PublicKey } from '@solana/web3.js'

import config from '../../app.config'

/**
 * @returns Chain balance of provided SPL token
 */
export const fetchSplBalance = async (connection: Connection, mintAddress: PublicKey) => {
  const response = await connection.getParsedTokenAccountsByOwner(config.SOL_PUBLIC_KEY, { mint: mintAddress })
  // Account does not exist, balance = 0
  if (!response.value[0]) {
    return 0
  }

  const { amount } = response.value[0].account.data.parsed.info.tokenAmount
  return Number(amount)
}
