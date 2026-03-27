import type { Command, CommandId } from '../../commands/commands.js'
import { MenuSectionIds } from '../../commands/ids.js'
import type { AppModule, AppModuleId } from '../types.js'
import { ExportDialog } from './ExportDialog.js'

const moduleId = 'export' as AppModuleId

const exportAudio: Command = {
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

  menuItems: [
    {
      menuSectionId: MenuSectionIds.FileExport,
      commandId: exportAudio.id,
      label: 'Export…'
    }
  ]
}
