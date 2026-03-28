import { createContext, useCallback, useEffect, useMemo, useState, type DependencyList, type FunctionComponent, type PropsWithChildren } from 'react'
import { useSafeContext } from '../../hooks/safe-context.js'
import { normalizeKeyboardShortcut, type KeyboardShortcut } from '../../input/keyboard-shortcuts.js'
import type { Command, CommandId, CommandRegistry, UnregisterCommand } from '../commands.js'

const CommandRegistryContext = createContext<CommandRegistry | undefined>(undefined)

export const CommandRegistryProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [commands, setCommands] = useState<readonly Command[]>([])

  const registerCommand = useCallback((command: Command): UnregisterCommand => {
    setCommands((prev) => [...prev, command])
    return () => setCommands((prev) => prev.filter((item) => item !== command))
  }, [])

  const byId = useMemo(() => toMapById(commands), [commands])
  const getCommandById = useCallback((id: CommandId) => byId.get(id), [byId])

  const byShortcut = useMemo(() => toMapByShortcut(commands), [commands])
  const getCommandByShortcut = useCallback((shortcut: KeyboardShortcut) => byShortcut.get(shortcut), [byShortcut])

  const value: CommandRegistry = useMemo(() => ({
    commands,
    registerCommand,
    getCommandById,
    getCommandByShortcut
  }), [
    commands,
    registerCommand,
    getCommandById,
    getCommandByShortcut
  ])

  return (
    <CommandRegistryContext value={value}>
      {children}
    </CommandRegistryContext>
  )
}

export function useCommandRegistry (): CommandRegistry {
  return useSafeContext(CommandRegistryContext, 'CommandRegistryContext')
}

export function useRegisterCommand (
  command: Command | (() => Command),
  deps: DependencyList
): Command {
  const { registerCommand } = useCommandRegistry()

  const instance = useMemo<Command>(() => {
    return typeof command === 'function' ? command() : command
  }, deps)

  // command object is expected to be stable (e.g. memoized)
  useEffect(() => {
    return registerCommand(instance)
  }, [registerCommand, instance])

  return instance
}

function toMapById (commands: readonly Command[]): ReadonlyMap<CommandId, Command> {
  return new Map(commands.map((command) => [command.id, command]))
}

function toMapByShortcut (commands: readonly Command[]): ReadonlyMap<KeyboardShortcut, Command> {
  const map = new Map<KeyboardShortcut, Command>()

  for (const command of commands) {
    for (const unnormalizedShortcut of command.keyboardShortcuts ?? []) {
      const shortcut = normalizeKeyboardShortcut(unnormalizedShortcut)

      const existing = map.get(shortcut)
      if (existing != null) {
        throw new Error(`Keyboard shortcut conflict: ${JSON.stringify(shortcut)} is assigned to both ${JSON.stringify(existing.id)} and ${JSON.stringify(command.id)}`)
      }

      map.set(shortcut, command)
    }
  }

  return map
}
