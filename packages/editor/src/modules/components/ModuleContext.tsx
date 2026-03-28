import { createContext, Fragment, type FunctionComponent, type PropsWithChildren } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { Module } from '../types.js'

const ModuleContext = createContext<readonly Module[] | undefined>([])

export const ModuleProvider: FunctionComponent<PropsWithChildren<{
  modules: readonly Module[]
}>> = ({ modules, children }) => {
  return (
    <ModuleContext value={modules}>
      {children}
    </ModuleContext>
  )
}

export const ModuleHost: FunctionComponent = () => {
  const modules = useModules()

  return modules.map(({ Commands, id }) => (
    <Fragment key={id}>
      {Commands != null && <Commands />}
    </Fragment>
  ))
}

export function useModules (): readonly Module[] {
  return useSafeContext(ModuleContext, 'ModuleContext')
}
