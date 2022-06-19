// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line max-classes-per-file
type Watcher<V extends unknown> = (newValue: V, oldValue: V) => void

export class Ref<V extends unknown> {
  private _value: V
  private _watchers: Watcher<V>[] = []

  constructor(initialValue: V) {
    this._value = initialValue
  }

  get value() {
    return this._value
  }

  set value(val: V) {
    const oldValue = this._value
    this._value = val
    this._watchers.forEach((cb) => {
      cb.call(null, val, oldValue)
    })
  }

  watch(watcher: Watcher<V>) {
    this._watchers.push(watcher)
  }
}

export const ref = <V extends unknown>(initialValue: V) => (
  new Ref<V>(initialValue)
)
