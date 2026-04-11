import { useRef, type RefObject } from 'react'

/**
 * A hook that returns a ref object always containing the latest value provided as an argument.
 */
export function useLatestRef<T> (value: T): Readonly<RefObject<T>> {
  const ref = useRef(value)
  ref.current = value

  return ref
}
