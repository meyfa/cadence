import { useSafeContext } from '@editor'
import { createContext, useEffect, type FunctionComponent, type PropsWithChildren } from 'react'
import { useCommandRegistry } from '../commands/registry.js'
import type { AppModule } from '../modules/types.js'

const ModuleContext = createContext<readonly AppModule[] | undefined>([])

export const ModuleProvider: FunctionComponent<PropsWithChildren<{
  modules: readonly AppModule[]
}>> = ({ modules, children }) => {
  const { registerCommands } = useCommandRegistry()

  useEffect(() => {
    return registerCommands(modules.flatMap((module) => module.commands ?? []))
  }, [modules, registerCommands])

  return (
    <ModuleContext value={modules}>
      {children}
    </ModuleContext>
  )
}

export function useModules (): readonly AppModule[] {
  return useSafeContext(ModuleContext, 'ModuleContext')
}
