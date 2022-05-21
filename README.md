# UXD arbitrage bot

## Setup

- Set app config in `src/app.config.ts`

```js
const config: Config = {
  ...,
  SOLANA_RPC_ENDPOINT: '', // solana RPC endpoint
  CLUSTER: '', // mainnet
  MIN_ARB_PERCENTAGE: number, // minimum price percentage - 0.2 is 0.2%
  LOG: boolean // If true log app status, and errors
  ...,
}

```

- Set env variables in `.env`

```env
SOL_PRIVATE_KEY=solana private key as string
SOL_PUBLIC_KEY=solana public key (solana address)
DISCORD_TOKEN=Discord BOT token secret
DISCORD_CHANNEL=Discord channel ID
```
