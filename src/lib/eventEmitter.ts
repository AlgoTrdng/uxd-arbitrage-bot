import EventEmitter from 'events'

type Events = {
  'arbitrage-success': () => void
}

type EventName = keyof Events

const eventEmitter = new EventEmitter()

export const eventListen = <E extends EventName>(event: E, callback: Events[E]) => {
  eventEmitter.on(event, callback)
}

export const eventEmit = <E extends EventName>(event: E, payload: Parameters<Events[E]>) => {
  eventEmitter.emit(event, payload)
}
