import type { Numeric } from '@utility'
import { useCallback, useEffect, useRef } from 'react'

export type PushOrigin<T> = (origin: T) => boolean

/**
 * Returns a function to track the origin of changes within a time window.
 * If the window is new or was started by the same origin, the function returns true.
 * Otherwise, it returns false.
 * Any call to the function resets the time window.
 */
export function useChangeOrigin<T extends string> (windowDuration: Numeric<'s'>): PushOrigin<T> {
  const originRef = useRef<T | undefined>(undefined)
  const pendingResetRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Clear any pending timeout on unmount to avoid stray timers
  useEffect(() => {
    return () => {
      if (pendingResetRef.current != null) {
        clearTimeout(pendingResetRef.current)
        pendingResetRef.current = undefined
      }
    }
  }, [])

  return useCallback((origin: T) => {
    const scheduleReset = () => {
      if (pendingResetRef.current != null) {
        clearTimeout(pendingResetRef.current)
      }

      pendingResetRef.current = setTimeout(() => {
        originRef.current = undefined
        pendingResetRef.current = undefined
      }, windowDuration.value * 1000)
    }

    scheduleReset()

    if (originRef.current != null && originRef.current !== origin) {
      return false
    }

    originRef.current = origin
    return true
  }, [windowDuration])
}
