import type { CommandId, MenuId, MenuSectionId, Module, ModuleId, PanelId } from '@editor'
import { activateTabOfType, useDialogService, useLayoutDispatch, useProvideProblems, useRegisterCommand } from '@editor'
import { numeric } from '@utility'
import { useEffect, useRef, type FunctionComponent } from 'react'
import { useCompilationState } from '../../components/contexts/CompilationContext.js'
import { useEditor, useEditorDispatch } from '../../components/contexts/EditorContext.js'
import { openTextFile, saveTextFile } from '../../utilities/files.js'
import { EditorPanel } from './EditorPanel.js'
import { LoadDemoDialog } from './LoadDemoDialog.js'

const DEFAULT_FILENAME = 'track.cadence'
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

  const editor = useEditor()
  const editorDispatch = useEditorDispatch()

  const editorRef = useRef({
    state: editor,
    dispatch: editorDispatch
  })

  useEffect(() => {
    editorRef.current = {
      state: editor,
      dispatch: editorDispatch
    }
  }, [editor, editorDispatch])

  const { errors } = useCompilationState()

  useRegisterCommand(() => ({
    id: viewEditorId,
    label: 'Show view: Editor',
    run: () => {
      layoutDispatch((layout) => activateTabOfType(layout, editorPanelId))
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
          editorRef.current.dispatch((state) => ({
            ...state,
            code: content,
            caret: undefined
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
        content: editorRef.current.state.code
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

  GlobalHooks,

  panels: [
    {
      id: editorPanelId,
      closeable: false,
      Panel: EditorPanel,
      Title: () => 'Editor'
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

  inserts: {
    footer: [
      {
        commandId: viewEditorId,
        position: 'end',
        Label: () => {
          const { caret } = useEditor()
          return `Ln ${caret?.line ?? '-'}, Col ${caret?.column ?? '-'}`
        }
      }
    ]
  }
}
