// eslint-disable-next-line no-unused-vars
type Watcher<V> = (newValue: V, oldValue: V) => void

class Ref<V extends any> {
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

  addWatchers(cb: Watcher<V>) {
    const idx = this._watchers.length
    this._watchers.push(cb)
    return idx
  }

  removeWatcher(idx: number) {
    this._watchers.splice(idx, 1)
  }
}

export const ref = <V extends any>(initialValue: V) => (
  new Ref<V>(initialValue)
)

export const watchRef = <V extends any>(target: Ref<V>, watcher: Watcher<V>) => {
  const idx = target.addWatchers(watcher)

  return () => {
    target.removeWatcher(idx)
  }
}
