# UXD arbitrage bot

## Setup

- Set app config in `app.config.json`

```json
{
  "minimumPriceDiff": number, // minimum price percentage - 0.2 is 0.2%
  "cluster": "", // mainnet
  "log": boolean, // if true, will log bot updates like status, swaps and redemptions

  "defaultUxdUiBalance": number,
  "maximumUxdUiBalance": number
}
```

- Set env variables in `.env`

```env
SOL_RPC_ENDPOINT=solana RPC endpoint url
SOL_PRIVATE_KEY=solana private key as string
DISCORD_TOKEN=Discord BOT token secret
DISCORD_CHANNEL_ID=Discord channel ID

# firebase config
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=

# firebase collection names
TRADES_COLLECTION=
```
