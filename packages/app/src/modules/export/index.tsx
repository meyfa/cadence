import type { CommandId, MenuId, MenuSectionId, Module, ModuleId } from '@editor'
import { useDialogService, useRegisterCommand } from '@editor'
import type { FunctionComponent } from 'react'
import { ExportDialog } from './ExportDialog.js'

const moduleId = 'export' as ModuleId

const fileMenuId = 'file' as MenuId
const fileExportSectionId = 'file.export' as MenuSectionId

const exportAudioId = `${moduleId}.file.export` as CommandId

const Commands: FunctionComponent = () => {
  const { showDialog } = useDialogService()

  useRegisterCommand(() => ({
    id: exportAudioId,
    label: 'File: Export',
    keyboardShortcuts: [
      'Ctrl+E'
    ],
    run: () => {
      showDialog(ExportDialog, {})
    }
  }), [showDialog])

  return null
}

export const exportModule: Module = {
  id: moduleId,

  Commands,

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
        commandId: exportAudioId,
        label: 'Export…'
      }
    ]
  }
}
