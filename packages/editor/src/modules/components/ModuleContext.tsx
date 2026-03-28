import { createContext, useEffect, type FunctionComponent, type PropsWithChildren } from 'react'
import type { Command } from '../../commands/commands.js'
import { useCommandRegistry } from '../../commands/components/CommandRegistryContext.js'
import { useSafeContext } from '../../hooks/safe-context.js'
import type { Module } from '../types.js'

const ModuleContext = createContext<readonly Module[] | undefined>([])

export const ModuleProvider: FunctionComponent<PropsWithChildren<{
  modules: ReadonlyArray<Module<any>>
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

export function useModules (): readonly Module[] {
  return useSafeContext(ModuleContext, 'ModuleContext')
}
