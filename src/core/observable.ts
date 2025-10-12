type UnsubscribeFn = () => void

type Observer<T> = (value: T) => void

export interface Observable<T> {
  readonly get: () => T
  readonly subscribe: (observer: Observer<T>) => UnsubscribeFn
}

export class MutableObservable<T> implements Observable<T> {
  private observers = new Set<Observer<T>>()
  private value: T

  constructor (initialValue: T) {
    this.value = initialValue
  }

  set (value: T): void {
    this.value = value

    for (const observer of this.observers) {
      observer(value)
    }
  }

  get (): T {
    return this.value
  }

  subscribe (observer: Observer<T>): UnsubscribeFn {
    this.observers.add(observer)
    observer(this.value)

    return () => {
      this.observers.delete(observer)
    }
  }
}
