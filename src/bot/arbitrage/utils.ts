import { Connection } from '@solana/web3.js'
import { UXD_DECIMALS, SOL_DECIMALS } from '@uxd-protocol/uxd-client'

import { MINIMUM_SOL_CHAIN_AMOUNT, mint } from '../../constants'
import { sendAndConfirmRedeem, SendRedeemTxError } from '../../lib/actions/redeem'
import { swapSolToUxd } from '../../lib/actions/swap'
import { getUiAmount } from '../../lib/utils/amount'
import { getPriceDifference } from '../../lib/utils/getPriceDifference'
import { wait } from '../../lib/utils/wait'
import { UxdWrapper, MangoWrapper, JupiterWrapper } from '../../lib/wrappers'
import { state } from '../../state'
import { force } from '../../lib/utils/force'
import { fetchSplBalance } from '../../lib/account'
import { CloseWrappedSolATA } from '../../lib/actions/closeWrappedSolATA'
import config from '../../app.config'

export const executeRedemption = async (
  connection: Connection,
  uxdWrapper: UxdWrapper,
  mangoWrapper: MangoWrapper,
  jupiterWrapper: JupiterWrapper,
) => {
  const preArbitrageUxdBalance = state.uxdChainBalance
  const safeUxdUiBalance = getUiAmount(preArbitrageUxdBalance, UXD_DECIMALS) - 1

  let redeemTx = await uxdWrapper.createRedeemRawTransaction(safeUxdUiBalance)
  console.log('⚠ Starting redemption with', safeUxdUiBalance)
  let redeemResponse = await sendAndConfirmRedeem(connection, redeemTx)

  while (typeof redeemResponse === 'string') {
    console.log('⚠ Repeating redemption')

    if (
      redeemResponse === SendRedeemTxError.BLOCK_HEIGHT_EXCEEDED
      || redeemResponse === SendRedeemTxError.ERROR
    ) {
      redeemTx = await uxdWrapper.createRedeemRawTransaction(safeUxdUiBalance)
    }

    const currentPriceDiff = await getPriceDifference(preArbitrageUxdBalance, mangoWrapper, jupiterWrapper)
    if (currentPriceDiff < config.minimumPriceDiff) {
      return false
    }

    await wait()
    redeemResponse = await sendAndConfirmRedeem(connection, redeemTx)
  }

  const { solChainBalance, uxdChainBalance } = redeemResponse
  state.solChainBalance = solChainBalance
  state.uxdChainBalance = uxdChainBalance

  return true
}

export const executeSwap = async (connection: Connection, jupiterWrapper: JupiterWrapper) => {
  const solUiBalance = getUiAmount(state.solChainBalance, SOL_DECIMALS)

  console.log('💱 Starting swap', solUiBalance)
  const startUxdBalance = state.uxdChainBalance
  let swapResult = await swapSolToUxd(jupiterWrapper, solUiBalance)

  while (!swapResult) {
    console.log('💱 Repeating swap', swapResult)

    await state.syncUxdBalance(connection)
    if (state.uxdChainBalance > startUxdBalance) {
      break
    }

    const wSolChainBalance = await force(
      () => fetchSplBalance(connection, mint.SOL),
      { wait: 200 },
    )
    if (wSolChainBalance) {
      console.log('Closing wrapped SOL ATA')
      await CloseWrappedSolATA.execute(connection)
    }

    await wait()
    swapResult = await swapSolToUxd(jupiterWrapper, solUiBalance)
  }

  await state.syncSolBalance(connection)
  // + 0.5 SOL to account for jupiter swapping lower amount than provided
  while (state.solChainBalance > MINIMUM_SOL_CHAIN_AMOUNT + 50_000_000) {
    await state.syncSolBalance(connection)
    await wait()
  }

  while (swapResult && state.uxdChainBalance < swapResult.outputAmount) {
    await state.syncUxdBalance(connection)
    await wait()
  }
}
