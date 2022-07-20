# CHANGELOG

- All notable changes will be documented in this file
- Date is following format DD.MM.YYYY

## [1.1.3] - 20.7.2022

- Fixed `@solana/web3.js` version to 1.47.3
  - 1.48.x has react-native in peer dependencies

## [1.1.2] - 20.7.2022

- Parse arb type to firebase type

## [1.1.1] - 20.7.2022

- Swapping back remaining SOL from `minting` arbitrage, because of UXD Program rounding

## [1.1.0] - 19.7.2022

- Code refactoring

### Added

- `Mint` arbitrage

## [1.0.2] - 7.6.2022

### Updated

- `@solana/web3.js` to 1.47.3
- `@jup-ag/core` to 1.0.0-beta.28
- `@blockworks-foundation/mango-client` to 3.6.7

## [1.0.1] - 6.6.2022

- Code refactoring

### Fix

- Firebase-admin config path

## [1.0.0] - 6.6.2022

- App rewrite, code cleaning and refactoring

- Executing arbitrage if price diff is more than X set %
- Re-balancing when UXD balance crosses X set threshold
- Logging arbitrage messages to Discord
- Saving arbitrage data to Firebase