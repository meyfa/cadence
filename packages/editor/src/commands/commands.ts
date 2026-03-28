import type { Brand } from '@utility'
import type { KeyboardShortcut } from '../input/keyboard-shortcuts.js'

export type CommandId = Brand<string, 'app.CommandId'>

export interface Command<TContext = unknown> {
  readonly id: CommandId
  readonly label: string
  readonly keyboardShortcuts?: readonly KeyboardShortcut[]
  readonly action: (context: TContext) => void
}

export type UnregisterCommand = () => void

export interface CommandRegistry<TContext = unknown> {
  readonly commands: ReadonlyArray<Command<TContext>>

  readonly registerCommand: (command: Command<TContext>) => UnregisterCommand
  readonly registerCommands: (commands: ReadonlyArray<Command<TContext>>) => UnregisterCommand

  readonly getCommandById: (id: CommandId) => Command<TContext> | undefined
  readonly findByShortcut: (shortcut: KeyboardShortcut) => Command<TContext> | undefined

  readonly dispatchCommand: (command: Command<TContext>, context: TContext) => void
  readonly dispatchCommandById: (id: CommandId, context: TContext) => void
}
