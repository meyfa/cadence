import type { Module, ModuleId } from '@editor'
import type { CommandContext } from '../../commands.js'
import { CommandPalette } from './CommandPalette.js'

const moduleId = 'command-palette' as ModuleId

export const commandPaletteModule: Module<CommandContext> = {
  id: moduleId,

  inserts: {
    header: [
      {
        position: 'middle',
        Component: CommandPalette
      }
    ]
  }
}
