import { createContext, useCallback, useEffect, useMemo, useState, type FunctionComponent, type PropsWithChildren } from 'react'
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

  const registerCommands = useCallback((commands: readonly Command[]): UnregisterCommand => {
    const set = new Set(commands)
    setCommands((prev) => [...prev, ...set])
    return () => setCommands((prev) => prev.filter((item) => !set.has(item)))
  }, [])

  const byId = useMemo(() => toMapById(commands), [commands])
  const getCommandById = useCallback((id: CommandId) => byId.get(id), [byId])

  const byShortcut = useMemo(() => toMapByShortcut(commands), [commands])
  const findByShortcut = useCallback((shortcut: KeyboardShortcut) => byShortcut.get(shortcut), [byShortcut])

  const dispatchCommand = useCallback((command: Command, context: unknown) => {
    command.action(context)
  }, [])

  const dispatchCommandById = useCallback((id: CommandId, context: unknown) => {
    const command = getCommandById(id)
    if (command != null) {
      dispatchCommand(command, context)
    }
  }, [getCommandById, dispatchCommand])

  const value: CommandRegistry = useMemo(() => ({
    commands,
    registerCommand,
    registerCommands,
    getCommandById,
    findByShortcut,
    dispatchCommand,
    dispatchCommandById
  }), [
    commands,
    registerCommand,
    registerCommands,
    getCommandById,
    findByShortcut,
    dispatchCommand,
    dispatchCommandById
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

export function useRegisterCommand (command: Command): void {
  const { registerCommand } = useCommandRegistry()

  useEffect(() => {
    return registerCommand(command)
  }, [command, registerCommand])
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
