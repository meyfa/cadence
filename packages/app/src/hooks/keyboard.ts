import { useEffect } from 'react'

export function useGlobalKeydown (handler: (event: KeyboardEvent) => void): void {
  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
    }
  }, [handler])
}
