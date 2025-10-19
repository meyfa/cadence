import { useEffect, useRef, type RefObject } from 'react'

/**
 * A hook that returns a mutable ref object containing the latest value of the given callback.
 */
export function useMutableCallback<T extends ((...args: any[]) => any) | undefined> (value: T): RefObject<T> {
  const callbackRef = useRef(value)

  useEffect(() => {
    callbackRef.current = value
  }, [value])

  return callbackRef
}
