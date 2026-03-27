import { useSafeContext } from '@editor'
import { createContext, useCallback, useEffect, useMemo, useRef, type FunctionComponent, type PropsWithChildren } from 'react'
import { getCommandById, useCommandContext, type Command, type CommandId } from './commands.js'

export interface CommandDispatcher {
  readonly dispatchCommand: (command: Command) => void
  readonly dispatchCommandById: (id: CommandId) => void
  readonly registerCommandPaletteOpener: (opener: () => void) => () => void
}

const CommandDispatcherContext = createContext<CommandDispatcher | undefined>(undefined)

export const CommandDispatcherProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const commandPaletteOpenerRef = useRef<(() => void) | undefined>(undefined)

  const showCommandPalette = useCallback(() => {
    commandPaletteOpenerRef.current?.()
  }, [])

  const commandContext = useCommandContext({ showCommandPalette })

  const dispatchCommand = useCallback((command: Command) => {
    command.action(commandContext)
  }, [commandContext])

  const dispatchCommandById = useCallback((id: CommandId) => {
    const command = getCommandById(id)
    if (command != null) {
      dispatchCommand(command)
    }
  }, [dispatchCommand])

  const registerCommandPaletteOpener = useCallback((opener: () => void) => {
    commandPaletteOpenerRef.current = opener

    return () => {
      if (commandPaletteOpenerRef.current === opener) {
        commandPaletteOpenerRef.current = undefined
      }
    }
  }, [])

  const value: CommandDispatcher = useMemo(() => ({
    dispatchCommand,
    dispatchCommandById,
    registerCommandPaletteOpener
  }), [dispatchCommand, dispatchCommandById, registerCommandPaletteOpener])

  return (
    <CommandDispatcherContext value={value}>
      {children}
    </CommandDispatcherContext>
  )
}

export function useCommandDispatcher (): CommandDispatcher {
  return useSafeContext(CommandDispatcherContext, 'CommandDispatcherContext')
}

export function useRegisterCommandPaletteOpener (opener: () => void): void {
  const { registerCommandPaletteOpener } = useCommandDispatcher()

  useEffect(() => {
    return registerCommandPaletteOpener(opener)
  }, [registerCommandPaletteOpener, opener])
}
