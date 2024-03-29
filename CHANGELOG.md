# CHANGELOG

- All notable changes will be documented in this file
- Date is following format DD.MM.YYYY

## [2.2.1] - 30.8.2022

### Added

- Reading DIRECTION env variable to set arb direction

## [2.2.0] - 30.8.2022

### Updated

- Stopped using Serum because of Jupiter bug
- Using redis

## [2.1.0] - 20.8.2022

### Updated

- Sending daily aggregate values to database

### Fix

- Updating UXD balance after SOL and UXD re-balancing
- Swapping remaining SOL after `mint` arbitrage
- Parsing responses from Jupiter setup and cleanup transactions


## [2.0.1] - 12.8.2022

- Getting UXD balance from TX response - fixes the old balances from fetching token balance

## [2.0.0] - 11.8.2022

- Rewrite v2
- Multiple price diff levels
- Price diffs averages

## [1.1.6] - 23.7.2022

- Bugfix: Recreating redeem and mint tx after blockHeight expires

## [1.1.5] - 21.7.2022

- Checking average of previous price diffs

## [1.1.4] - 21.7.2022

- Fixed decimal rounding on mint arb initial swap retry

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