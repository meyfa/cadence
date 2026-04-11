import type { CommandId, MenuId, MenuSectionId, Module, ModuleId, PanelId } from '@editor'
import { activateTabOfType, getProjectFileContent, setProjectFileContent, useDialogService, useLatestRef, useLayout, useLayoutDispatch, useProjectSource, useProjectSourceDispatch, useProvideProblems, useRegisterCommand } from '@editor'
import { numeric } from '@utility'
import type { FunctionComponent } from 'react'
import { useCompilationState } from '../../compilation/CompilationContext.js'
import { TRACK_FILE_PATH } from '../../persistence/constants.js'
import { openTextFile, saveTextFile } from '../../utilities/files.js'
import { getFocusedEditorCaret } from './caret.js'
import { EditorPanel } from './components/EditorPanel.js'
import { LoadDemoDialog } from './components/LoadDemoDialog.js'
import { ResetProjectSettingsCard } from './components/ResetProjectSettingsCard.js'
import { getEditorPanelProps, type EditorPanelProps } from './panel-props.js'
import { EditorProvider, useEditor, useEditorDispatch } from './provider.js'

const DEFAULT_FILENAME = TRACK_FILE_PATH
const FILE_ACCEPT = '.cadence,text/plain'
const FILE_OPEN_TIMEOUT = numeric('s', 5)

const moduleId = 'editor' as ModuleId
export const editorPanelId = `${moduleId}.editor` as PanelId

const fileMenuId = 'file' as MenuId
const viewShowSectionId = 'view.show' as MenuSectionId
const fileSaveSectionId = 'file.save' as MenuSectionId

const viewEditorId = `${moduleId}.view.editor` as CommandId
const fileOpenId = `${moduleId}.file.open` as CommandId
const fileSaveId = `${moduleId}.file.save` as CommandId
const loadDemoId = `${moduleId}.load-demo` as CommandId

const GlobalHooks: FunctionComponent = () => {
  const layoutDispatch = useLayoutDispatch()
  const { showDialog } = useDialogService()

  const source = useProjectSource()
  const sourceDispatch = useProjectSourceDispatch()
  const editorDispatch = useEditorDispatch()

  const editorRef = useLatestRef({
    source,
    sourceDispatch,
    editorDispatch
  })

  const { result: { errors } } = useCompilationState()

  useRegisterCommand(() => ({
    id: viewEditorId,
    label: 'Show view: Editor',
    run: () => {
      layoutDispatch((layout) => activateTabOfType(layout, editorPanelId, () => ({
        type: editorPanelId,
        props: { filePath: TRACK_FILE_PATH } satisfies EditorPanelProps
      })))
    }
  }), [layoutDispatch])

  useRegisterCommand(() => ({
    id: fileOpenId,
    label: 'File: Open',
    keyboardShortcuts: [
      'Ctrl+O'
    ],
    run: () => {
      openTextFile({
        accept: FILE_ACCEPT,
        signal: AbortSignal.timeout(FILE_OPEN_TIMEOUT.value * 1000)
      }).then((content) => {
        if (content != null) {
          editorRef.current.sourceDispatch((state) => setProjectFileContent(state, TRACK_FILE_PATH, content))
          editorRef.current.editorDispatch((state) => ({
            ...state,
            carets: {}
          }))
        }
      }).catch(() => {
      // ignore errors
      })
    }
  }), [])

  useRegisterCommand(() => ({
    id: fileSaveId,
    label: 'File: Save',
    keyboardShortcuts: [
      'Ctrl+S'
    ],
    run: () => {
      saveTextFile({
        filename: DEFAULT_FILENAME,
        content: getProjectFileContent(editorRef.current.source, TRACK_FILE_PATH) ?? ''
      })
    }
  }), [])

  useRegisterCommand(() => ({
    id: loadDemoId,
    label: 'File: Load demo project',
    run: () => {
      showDialog(LoadDemoDialog, { editorPanelId })
    }
  }), [showDialog])

  useProvideProblems(moduleId, 'Compiler', errors)

  return null
}

export const editorModule: Module = {
  id: moduleId,

  Provider: EditorProvider,

  GlobalHooks,

  panels: [
    {
      id: editorPanelId,
      closeable: false,
      Panel: EditorPanel,
      Title: ({ panelProps }) => {
        const { filePath } = getEditorPanelProps(panelProps)
        return filePath.split('/').pop() ?? filePath
      }
    }
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
        commandId: viewEditorId,
        label: 'Editor'
      },
      {
        sectionId: fileSaveSectionId,
        commandId: fileOpenId,
        label: 'Open…'
      },
      {
        sectionId: fileSaveSectionId,
        commandId: fileSaveId,
        label: 'Save…'
      }
    ]
  },

  settings: {
    cards: [
      ResetProjectSettingsCard
    ]
  },

  inserts: {
    footer: [
      {
        commandId: viewEditorId,
        position: 'end',
        Label: () => {
          const layout = useLayout()
          const editor = useEditor()
          const caret = getFocusedEditorCaret(layout, editorPanelId, editor.carets)
          return `Ln ${caret?.line ?? '-'}, Col ${caret?.column ?? '-'}`
        }
      }
    ]
  }
}
