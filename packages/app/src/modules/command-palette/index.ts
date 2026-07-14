import type { Module, ModuleId } from '@meyfa/cadence-editor'
import { CommandPalette } from './CommandPalette.tsx'

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
