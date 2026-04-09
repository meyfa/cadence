import type { Numeric } from '@utility'
import { useEffect, useState } from 'react'

export function useDebouncedValue<T> (value: T, delay: Numeric<'s'>): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  const delayMs = delay.value * 1000

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timeout)
  }, [value, delayMs])

  return debouncedValue
}
