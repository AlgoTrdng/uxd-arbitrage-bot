import { ref, Ref } from './lib/reactive'

type State = {
  uxdChainBalance: Ref<number>
  solChainBalance: Ref<number>
  wrappedSolChainBalance: Ref<number>

  appStatus: 'rebalancing' | 'inArbitrage' | 'scanning'
}

export const state: State = {
  uxdChainBalance: ref(400),
  solChainBalance: ref(0),
  wrappedSolChainBalance: ref(0),

  appStatus: 'scanning',
}
