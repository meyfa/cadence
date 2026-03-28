import type { Module, ModuleId } from '@editor'
import { CommandPalette } from './CommandPalette.js'

const moduleId = 'command-palette' as ModuleId

export const commandPaletteModule: Module = {
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
