# Arbitrage mechanism

- Execute only if current price diff is more than 0.2% and MA of n preceding price diffs is at least 0.1% (?) (1)

- Dynamic position size
  - Lower the size of positions based on transaction without profit and vice versa

- re-balancing (?)

# Code

- Refactor bot stages (arbitrage, recorder)
  - Should have ONE entry function, helpers outside of file

# Analytics

- (1) Keep track of price differences before arbitrage happens

- Keep track of elapse time of redemption and swaps relation with profits to determine whether to check price diff after every transaction sent
