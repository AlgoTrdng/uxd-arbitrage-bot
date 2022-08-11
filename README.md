# UXD arbitrage bot

## Setup

### Install dependencies

```sh
pnpm i
```

### Set env variables in `.env`

```env
SOL_RPC_ENDPOINT=
SOL_PRIVATE_KEY=solana private key byte array as string

DISCORD_CHANNEL_ID=
DISCORD_SECRET=

# Firebase config
FB_PRIVATE_KEY=
FB_PROJECT_ID=
FB_CLIENT_EMAIL=
FB_COLLECTION_NAME=

STATUS_API=
STATUS_SECRET=
```

### Set app config in `app.config.json`

- Development config is used with
  - `npm run pm2:development`
  - `npm run start:development`
- Production config is used with
  - `npm run pm2:production`
  - `npm run start:production`

</br>

- `minMaPriceDiff` - minimum percentage value of MA of last 20 price diffs
- `maxUxdAmountUi`,`maxUxdAmountUi`
  - If UXD amount reaches `maxUxdAmountUi` threshold, bot swaps all UXD above `maxUxdAmountUi` to USDC
- `minSolAmountUi` - minimum SOL amount to always be left in account for fees and such, 0.05 means 0.05 SOL

```json
{
  "development": {
    "minPriceDiff": "number",
    "minMaPriceDiff": "number",

    "maxUxdAmountUi": "number",
    "minUxdAmountUi": "number",

    "minSolAmountUi": "number",
  },
  "production": {
    "minPriceDiff": "number",
    "minMaPriceDiff": "number",

    "maxUxdAmountUi": "number",
    "minUxdAmountUi": "number",

    "minSolAmountUi": "number",
  }
}
```

## Start bot

- Development
```sh
npm run start:dev
```

- Production
```sh
npm run start:prod
```
