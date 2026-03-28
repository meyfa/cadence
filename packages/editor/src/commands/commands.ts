import type { Brand } from '@utility'
import type { KeyboardShortcut } from '../input/keyboard-shortcuts.js'

export type CommandId = Brand<string, 'app.CommandId'>

export interface Command {
  readonly id: CommandId
  readonly label: string
  readonly keyboardShortcuts?: readonly KeyboardShortcut[]
  readonly run: () => void
}

export type UnregisterCommand = () => void

export interface CommandRegistry {
  readonly commands: readonly Command[]

  readonly registerCommand: (command: Command) => UnregisterCommand

  readonly getCommandById: (id: CommandId) => Command | undefined
  readonly getCommandByShortcut: (shortcut: KeyboardShortcut) => Command | undefined
}
