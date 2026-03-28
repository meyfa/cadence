import type { Command, CommandId, MenuId, MenuSectionId } from '@editor'
import type { CommandContext } from '../../commands.js'
import type { AppModule, AppModuleId } from '../types.js'
import { ExportDialog } from './ExportDialog.js'

const moduleId = 'export' as AppModuleId

const fileMenuId = 'file' as MenuId
const fileExportSectionId = 'file.export' as MenuSectionId

const exportAudio: Command<CommandContext> = {
  id: `${moduleId}.file.export` as CommandId,
  label: 'File: Export',
  keyboardShortcuts: [
    'Ctrl+E'
  ],
  action: ({ showDialog }) => {
    showDialog(ExportDialog)
  }
}

export const exportModule: AppModule = {
  id: moduleId,

  commands: [
    exportAudio
  ],

  menu: {
    sections: [
      {
        id: fileExportSectionId,
        menuId: fileMenuId
      }
    ],

    items: [
      {
        sectionId: fileExportSectionId,
        commandId: exportAudio.id,
        label: 'Export…'
      }
    ]
  }
}
