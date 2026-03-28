import { createContext, type FunctionComponent, type PropsWithChildren } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { Module } from '../types.js'

const ModuleContext = createContext<readonly Module[] | undefined>([])

export const ModuleProvider: FunctionComponent<PropsWithChildren<{
  modules: readonly Module[]
}>> = ({ modules, children }) => {
  return (
    <ModuleContext value={modules}>
      {modules.map(({ Commands, id }) => Commands != null && <Commands key={id} />)}
      {children}
    </ModuleContext>
  )
}

export function useModules (): readonly Module[] {
  return useSafeContext(ModuleContext, 'ModuleContext')
}
