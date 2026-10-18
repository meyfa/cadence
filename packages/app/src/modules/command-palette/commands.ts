import type { Command, CommandId } from '@meyfa/cadence-editor'

export function createShowPaletteCommand (show: () => void): Command {
  return {
    id: 'commands.show-all' as CommandId,
    label: 'Show all commands',
    keyboardShortcuts: [
      // Ctrl-Shift-P may be reserved by some browsers
      'Ctrl+P',
      'Ctrl+Shift+P',
      'F1'
    ],
    run: show
  }
}
