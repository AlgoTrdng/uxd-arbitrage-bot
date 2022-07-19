import EventEmitter from 'events'
import { ArbitrageType } from '../../state'

type ArbitrageStartPayload = {
  uxdChainBalance: number
  type: ArbitrageType
}

type Events = {
  'arbitrage-success': (uxdChainBalance: number) => void
  'arbitrage-start': (payload: ArbitrageStartPayload) => void

  're-balance-success': (config: { preUxdChainBalance: number, postUxdChainBalance: number }) => void
}

type EventName = keyof Events

const eventEmitter = new EventEmitter()

export const listenForEvent = <E extends EventName>(event: E, callback: Events[E]) => {
  eventEmitter.on(event, callback)
}

export const emitEvent = <E extends EventName>(event: E, ...payload: Parameters<Events[E]>) => {
  eventEmitter.emit(event, ...payload)
}
