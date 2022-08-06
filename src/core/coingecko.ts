import fetch from 'node-fetch'

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=USD'
const CACHE_TIME = 10_000

type PrevRequest = {
  ts: number
  price: number
}

let prev: PrevRequest | null = null

type CoingeckoResponse = {
  solana: {
    usd: number
  }
}

export const fetchCoingeckoSolPrice = async () => {
  if (prev && prev.ts > new Date().getTime() - CACHE_TIME) {
    return prev.price
  }

  try {
    const { solana } = await (
      await fetch(COINGECKO_API_URL)
    ).json() as CoingeckoResponse
    prev = {
      ts: new Date().getTime(),
      price: solana.usd,
    }
    return solana.usd
  } catch (error) {
    return null
  }
}
