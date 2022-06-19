import EventEmitter from 'events'

type Events = {
  'arbitrage-success': (uxdChainBalance: number) => void
  'arbitrage-start': (uxdChainBalance: number) => void

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
