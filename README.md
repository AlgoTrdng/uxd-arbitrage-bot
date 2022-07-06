# UXD arbitrage bot

## Setup

- Install dependencies

```sh
npm i
```

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
FIREBASE_PROJECT_ID=

# firebase collection names
TRADES_COLLECTION=
```

- Set firebase credentials in:
  - `firebase-admin-credentials.prod.json` for production
  - `firebase-admin-credentials.dev.json` for development

## Start bot

- Development
```sh
npm run start:dev
```

- Production
```sh
npm run start:prod
```

# TODO

## Arbitrage mechanism

- Execute only if current price diff is more than 0.2% and MA of n preceding price diffs is at least 0.1% (?) (1)

- Dynamic position size
  - Lower the size of positions based on transaction without profit and vice versa

## Analytics

- (1) Keep track of price differences before arbitrage happens

