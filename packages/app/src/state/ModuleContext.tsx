import { useCommandRegistry, useSafeContext, type Command } from '@editor'
import { createContext, useEffect, type FunctionComponent, type PropsWithChildren } from 'react'
import type { AppModule } from '../modules/types.js'

const ModuleContext = createContext<readonly AppModule[] | undefined>([])

export const ModuleProvider: FunctionComponent<PropsWithChildren<{
  modules: readonly AppModule[]
}>> = ({ modules, children }) => {
  const { registerCommands } = useCommandRegistry()

  useEffect(() => {
    const commands = modules.flatMap((module) => module.commands ?? []) as readonly Command[]
    return registerCommands(commands)
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
