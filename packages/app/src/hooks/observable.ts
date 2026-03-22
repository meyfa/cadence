import type { Observable } from '@core'
import { useEffect, useState } from 'react'

export function useObservable<T> (observable: Observable<T>): T {
  const [value, setValue] = useState(observable.get())

  useEffect(() => observable.subscribe((newValue) => {
    // Use functional update to avoid bugs in case T is itself a function
    setValue(() => newValue)
  }), [observable])

  return value
}
