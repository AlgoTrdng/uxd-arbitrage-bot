# UXD arbitrage bot

## Setup

- Set app config in `src/app.config.ts`

```js
const config: Config = {
  ...,
  CLUSTER: '', // mainnet
  MIN_ARB_PERCENTAGE: number, // minimum price percentage - 0.2 is 0.2%
  LOG: boolean, // if true, will log bot updates like status, swaps and redemptions
  ...,
}

```

- Set env variables in `.env`

```env
SOL_RPC_ENDPOINT=solana RPC endpoint url
SOL_PRIVATE_KEY=solana private key as string
SOL_PUBLIC_KEY=solana public key (solana address)
DISCORD_TOKEN=Discord BOT token secret
DISCORD_CHANNEL_ID=Discord channel ID
```
