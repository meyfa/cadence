import { activateTabOfType } from '@editor'
import { numeric } from '@utility'
import type { Command, CommandId } from '../../commands/commands.js'
import type { MenuId, MenuSectionId } from '../../commands/menus.js'
import { useEditor } from '../../state/EditorContext.js'
import { openTextFile, saveTextFile } from '../../utilities/files.js'
import type { AppModule, AppModuleId, AppModulePanelId } from '../types.js'
import { EditorPanel } from './EditorPanel.js'

const moduleId = 'editor' as AppModuleId
export const editorPanelId = `${moduleId}.editor` as AppModulePanelId

const fileMenuId = 'file' as MenuId
const viewShowSectionId = 'view.show' as MenuSectionId
const fileSaveSectionId = 'file.save' as MenuSectionId

const DEFAULT_FILENAME = 'track.cadence'
const FILE_ACCEPT = '.cadence,text/plain'
const FILE_OPEN_TIMEOUT = numeric('s', 5)

const viewEditor: Command = {
  id: `${moduleId}.view.editor` as CommandId,
  label: 'Show view: Editor',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, editorPanelId)
  }
}

const fileOpen: Command = {
  id: `${moduleId}.file.open` as CommandId,
  label: 'File: Open',
  keyboardShortcuts: [
    'Ctrl+O'
  ],
  action: ({ editor }) => {
    openTextFile({
      accept: FILE_ACCEPT,
      signal: AbortSignal.timeout(FILE_OPEN_TIMEOUT.value * 1000)
    }).then((content) => {
      if (content != null) {
        editor.dispatch((state) => ({
          ...state,
          code: content,
          caret: undefined
        }))
      }
    }).catch(() => {
      // ignore errors
    })
  }
}

const fileSave: Command = {
  id: `${moduleId}.file.save` as CommandId,
  label: 'File: Save',
  keyboardShortcuts: [
    'Ctrl+S'
  ],
  action: ({ editor }) => {
    saveTextFile({
      filename: DEFAULT_FILENAME,
      content: editor.state.code
    })
  }
}

export const editorModule: AppModule = {
  id: moduleId,

  panels: [
    {
      id: editorPanelId,
      closeable: false,
      Panel: EditorPanel,
      Title: () => 'Editor'
    }
  ],

  commands: [
    viewEditor,
    fileOpen,
    fileSave
  ],

  menu: {
    sections: [
      {
        id: fileSaveSectionId,
        menuId: fileMenuId
      }
    ],

    items: [
      {
        sectionId: viewShowSectionId,
        commandId: viewEditor.id,
        label: 'Editor'
      },
      {
        sectionId: fileSaveSectionId,
        commandId: fileOpen.id,
        label: 'Open…'
      },
      {
        sectionId: fileSaveSectionId,
        commandId: fileSave.id,
        label: 'Save…'
      }
    ]
  },

  inserts: {
    footer: [
      {
        commandId: viewEditor.id,
        position: 'end',
        Label: () => {
          const [editor] = useEditor()
          return `Ln ${editor.caret?.line ?? '-'}, Col ${editor.caret?.column ?? '-'}`
        }
      }
    ]
  }
}
