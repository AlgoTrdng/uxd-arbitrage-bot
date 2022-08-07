# UXD arbitrage bot

## Setup

- Install dependencies

```sh
pnpm i
```

- Set env variables in `.env`

```env
SOL_RPC_ENDPOINT=solana RPC endpoint url
SOL_PRIVATE_KEY=solana private key byte array as string

# If UXD amount reaches MAX_UXD_AMOUNT_UI threshold,
# bot swaps all UXD above MIN_UXD_AMOUNT_UI to USDC
MAX_UXD_AMOUNT_UI=number
MIN_UXD_AMOUNT_UI=number
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

# TODO

- Setup production and development configs in json file
