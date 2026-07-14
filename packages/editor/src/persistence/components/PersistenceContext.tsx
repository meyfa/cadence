import type { FunctionComponent, PropsWithChildren } from 'react'
import { createContext } from 'react'
import { useSafeContext } from '../../hooks/safe-context.ts'
import type { PersistenceEngine } from '../engine.ts'

interface PersistenceContextValue {
  readonly engine: PersistenceEngine
}

export const PersistenceContext = createContext<PersistenceContextValue | undefined>(undefined)

export const PersistenceProvider: FunctionComponent<PropsWithChildren<{
  readonly engine: PersistenceEngine
}>> = ({ engine, children }) => {
  return (
    <PersistenceContext value={{ engine }}>
      {children}
    </PersistenceContext>
  )
}

export function usePersistenceContext (): PersistenceContextValue {
  return useSafeContext(PersistenceContext, 'PersistenceContext')
}
