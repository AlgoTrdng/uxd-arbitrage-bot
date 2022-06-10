import { ref, Ref } from './lib/reactive'

type AppStatus = 'rebalancing' | 'inArbitrage' | 'scanning'

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

state.appStatus.watch((value) => {
  console.log(`❗ APP Status changed: ${value}`)
})
