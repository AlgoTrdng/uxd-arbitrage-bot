import { ref, Ref } from './lib/reactive'

/*
scanning -> Not in arbitrage, scanning price differences
scanning__arbitrageFail -> Price diff fallen too low while redeeming, ending arbitrage
  - different status because of logging

swappingRemainingSol -> Found remaining SOL after arbitrage failed, swaps to UXD

inArbitrage -> Started arbitrage, price diff was high enough

rebalancing -> UXD amount is too high, swapping for UXD
*/

type AppStatus = 'rebalancing' | 'inArbitrage' | 'scanning' | 'scanning__arbitrageFail' | 'swappingRemainingSol'

type State = {
  uxdChainBalance: number
  solChainBalance: number
  wrappedSolChainBalance: number

  appStatus: Ref<AppStatus>
}

export const state: State = {
  uxdChainBalance: 400,
  solChainBalance: 0,
  wrappedSolChainBalance: 0,

  appStatus: ref<AppStatus>('scanning'),
}
