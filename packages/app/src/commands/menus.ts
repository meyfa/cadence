import type { Brand } from '@utility'
import type { CommandId } from './commands.js'
import { CommandIds } from './ids.js'

export interface MenuItem {
  readonly commandId: CommandId
  readonly label: string
}

export interface MenuSection {
  readonly items: readonly MenuItem[]
}

export type MenuId = Brand<string, 'app.MenuId'>

export interface Menu {
  readonly id: MenuId
  readonly label: string
  readonly sections: readonly MenuSection[]
}

export const mainMenu: readonly Menu[] = [
  {
    id: 'file' as MenuId,
    label: 'File',
    sections: [
      {
        items: [
          { commandId: CommandIds.FileOpen, label: 'Open…' },
          { commandId: CommandIds.FileSave, label: 'Save…' }
        ]
      },
      {
        items: [
          { commandId: CommandIds.FileExport, label: 'Export…' }
        ]
      }
    ]
  },
  {
    id: 'view' as MenuId,
    label: 'View',
    sections: [
      {
        items: [
          { commandId: CommandIds.ViewEditor, label: 'Editor' },
          { commandId: CommandIds.ViewMixer, label: 'Mixer' },
          { commandId: CommandIds.ViewSettings, label: 'Settings' },
          { commandId: CommandIds.ViewProblems, label: 'Problems' },
          { commandId: CommandIds.ViewTimeline, label: 'Timeline' }
        ]
      },
      {
        items: [
          { commandId: CommandIds.LayoutReset, label: 'Reset layout' }
        ]
      }
    ]
  }
]
