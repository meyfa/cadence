import { CommandId } from './ids.js'

export interface MenuItem {
  readonly commandId: string
  readonly label: string
}

export interface MenuSection {
  readonly items: readonly MenuItem[]
}

export interface Menu {
  readonly id: string
  readonly label: string
  readonly sections: readonly MenuSection[]
}

export const mainMenu: readonly Menu[] = [
  {
    id: 'file',
    label: 'File',
    sections: [
      {
        items: [
          { commandId: CommandId.FileOpen, label: 'Open…' },
          { commandId: CommandId.FileSave, label: 'Save…' }
        ]
      },
      {
        items: [
          { commandId: CommandId.FileExport, label: 'Export…' }
        ]
      }
    ]
  },
  {
    id: 'view',
    label: 'View',
    sections: [
      {
        items: [
          { commandId: CommandId.ViewEditor, label: 'Editor' },
          { commandId: CommandId.ViewMixer, label: 'Mixer' },
          { commandId: CommandId.ViewSettings, label: 'Settings' },
          { commandId: CommandId.ViewProblems, label: 'Problems' },
          { commandId: CommandId.ViewTimeline, label: 'Timeline' }
        ]
      },
      {
        items: [
          { commandId: CommandId.LayoutReset, label: 'Reset layout' }
        ]
      }
    ]
  }
]
