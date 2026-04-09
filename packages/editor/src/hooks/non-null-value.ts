import { useEffect, useState } from 'react'

/**
 * Return the most recent non-null/undefined value of the input.
 */
export function useNonNullValue<T> (value: T | undefined): T | undefined {
  const [lastValue, setLastValue] = useState(value)

  useEffect(() => {
    if (value != null) {
      setLastValue(value)
    }
  }, [value])

  return lastValue
}
