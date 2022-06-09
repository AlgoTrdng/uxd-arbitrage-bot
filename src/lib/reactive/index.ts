// eslint-disable-next-line no-unused-vars
// eslint-disable-next-line max-classes-per-file
type Watcher<V> = (newValue: V, oldValue: V) => void

export class Ref<V extends any> {
  private _value: V
  private _watchers: Watcher<V>[] = []

  constructor(initialValue: V) {
    this._value = initialValue
  }

  get value() {
    return this._value
  }

  set value(val: V) {
    this._watchers.forEach((cb) => {
      cb.call(null, val, this._value)
    })
    this._value = val
  }

  watch(watcher: Watcher<V>) {
    this._watchers.push(watcher)
  }
}

export const ref = <V extends any>(initialValue: V) => (
  new Ref<V>(initialValue)
)
