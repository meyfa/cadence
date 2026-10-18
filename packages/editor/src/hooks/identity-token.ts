import type { Brand } from '@meyfa/cadence-utility'
import { useEffect, useMemo, useRef } from 'react'

export type IdentityToken = Brand<number, 'editor.IdentityToken'>

export interface IdentityTokenHook {
  readonly current: IdentityToken
  readonly next: () => IdentityToken
}

export function useIdentityToken (): IdentityTokenHook {
  const ref = useRef(0 as IdentityToken)

  // invalidate on unmount
  useEffect(() => {
    return () => {
      ++ref.current
    }
  }, [])

  return useMemo(() => ({
    get current () {
      return ref.current
    },

    next: () => (++ref.current) as IdentityToken
  }), [])
}
