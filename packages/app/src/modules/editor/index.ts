import type { Module, ModuleId, PanelId, Command, CommandId, MenuId, MenuSectionId } from '@editor'
import { activateTabOfType } from '@editor'
import { numeric } from '@utility'
import type { CommandContext } from '../../commands.js'
import { useEditor } from '../../state/EditorContext.js'
import { openTextFile, saveTextFile } from '../../utilities/files.js'
import { EditorPanel } from './EditorPanel.js'

const moduleId = 'editor' as ModuleId
export const editorPanelId = `${moduleId}.editor` as PanelId

const fileMenuId = 'file' as MenuId
const viewShowSectionId = 'view.show' as MenuSectionId
const fileSaveSectionId = 'file.save' as MenuSectionId

const DEFAULT_FILENAME = 'track.cadence'
const FILE_ACCEPT = '.cadence,text/plain'
const FILE_OPEN_TIMEOUT = numeric('s', 5)

const viewEditor: Command<CommandContext> = {
  id: `${moduleId}.view.editor` as CommandId,
  label: 'Show view: Editor',
  action: ({ layoutDispatch }) => {
    activateTabOfType(layoutDispatch, editorPanelId)
  }
}

const fileOpen: Command<CommandContext> = {
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

const fileSave: Command<CommandContext> = {
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

export const editorModule: Module<CommandContext> = {
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
