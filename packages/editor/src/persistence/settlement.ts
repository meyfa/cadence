import { useEffect, useState } from 'react'
import { usePersistenceContext } from './components/PersistenceContext.js'

/**
 * Returns true once there are no pending loads. This can be used to delay rendering until
 * the initial state has been loaded, preventing flashes of default state.
 */
export function useLoadSettled (): boolean {
  const { engine } = usePersistenceContext()

  const [settled, setSettled] = useState(false)

  useEffect(() => {
    const nextTick = requestAnimationFrame(() => {
      if (!engine.isLoading) {
        setSettled(true)
      }
    })

    return () => cancelAnimationFrame(nextTick)
  }, [engine])

  return settled
}
