import { normalizeKeyboardShortcut, useSafeContext, type KeyboardShortcut } from '@editor'
import { createContext, useCallback, useEffect, useMemo, useState, type FunctionComponent, type PropsWithChildren } from 'react'
import { useCommandContext, type Command, type CommandId } from './commands.js'

type Unregister = () => void

export interface CommandRegistry {
  readonly commands: readonly Command[]

  readonly registerCommand: (command: Command) => Unregister
  readonly registerCommands: (commands: readonly Command[]) => Unregister

  readonly getCommandById: (id: CommandId) => Command | undefined
  readonly findByShortcut: (shortcut: KeyboardShortcut) => Command | undefined

  readonly dispatchCommand: (command: Command) => void
  readonly dispatchCommandById: (id: CommandId) => void
}

const CommandRegistryContext = createContext<CommandRegistry | undefined>(undefined)

export const CommandRegistryProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const context = useCommandContext()

  const [commands, setCommands] = useState<readonly Command[]>([])

  const registerCommand = useCallback((command: Command): Unregister => {
    setCommands((prev) => [...prev, command])
    return () => setCommands((prev) => prev.filter((item) => item !== command))
  }, [])

  const registerCommands = useCallback((commands: readonly Command[]): Unregister => {
    const set = new Set(commands)
    setCommands((prev) => [...prev, ...set])
    return () => setCommands((prev) => prev.filter((item) => !set.has(item)))
  }, [])

  const byId = useMemo(() => toMapById(commands), [commands])
  const getCommandById = useCallback((id: CommandId) => byId.get(id), [byId])

  const byShortcut = useMemo(() => toMapByShortcut(commands), [commands])
  const findByShortcut = useCallback((shortcut: KeyboardShortcut) => byShortcut.get(shortcut), [byShortcut])

  const dispatchCommand = useCallback((command: Command) => {
    command.action(context)
  }, [context])

  const dispatchCommandById = useCallback((id: CommandId) => {
    const command = getCommandById(id)
    if (command != null) {
      dispatchCommand(command)
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
