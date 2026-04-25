import { syntaxTree } from '@codemirror/language'
import { EditorSelection } from '@codemirror/state'
import type { CommandId, MenuId, MenuSectionId, Module, ModuleId, PanelId, Problem } from '@editor'
import { activateTabOfType, getProjectFileContent, setProjectFileContent, useDialogService, useLatestRef, useLayout, useLayoutDispatch, useProjectSource, useProjectSourceDispatch, useProvideProblems, useRegisterCommand } from '@editor'
import { applySemanticOperation, goToDefinition } from '@language-support'
import type { FunctionComponent } from 'react'
import { useMemo } from 'react'
import { useCompilationState } from '../../compilation/CompilationContext.js'
import { TRACK_FILE_PATH } from '../../persistence/constants.js'
import { openFiles, readFileAsText, saveTextFile } from '../../utilities/files.js'
import { getFocusedEditorCaret } from './caret.js'
import { EditorPanel } from './components/EditorPanel.js'
import { LoadDemoDialog } from './components/LoadDemoDialog.js'
import { ResetProjectSettingsCard } from './components/ResetProjectSettingsCard.js'
import type { EditorPanelProps } from './panel-props.js'
import { getEditorPanelProps } from './panel-props.js'
import { EditorProvider, useEditor, useEditorDispatch, useEditorRuntime } from './provider.js'

const DEFAULT_FILENAME = TRACK_FILE_PATH
const FILE_TYPES = [
  {
    description: 'Cadence files',
    accept: {
      'text/plain': ['.cadence']
    }
  }
]

const moduleId = 'editor' as ModuleId
export const editorPanelId = `${moduleId}.editor` as PanelId

const fileMenuId = 'file' as MenuId
const viewShowSectionId = 'view.show' as MenuSectionId
const fileSaveSectionId = 'file.save' as MenuSectionId

const viewEditorId = `${moduleId}.view.editor` as CommandId
const fileOpenId = `${moduleId}.file.open` as CommandId
const fileSaveId = `${moduleId}.file.save` as CommandId
const loadDemoId = `${moduleId}.load-demo` as CommandId
const goToDefinitionId = `${moduleId}.go-to-definition` as CommandId

const GlobalHooks: FunctionComponent = () => {
  const layoutDispatch = useLayoutDispatch()
  const { showDialog } = useDialogService()

  const source = useProjectSource()
  const sourceDispatch = useProjectSourceDispatch()
  const editorDispatch = useEditorDispatch()
  const editorRuntime = useEditorRuntime()

  const editorRef = useLatestRef({
    source,
    sourceDispatch,
    editorDispatch,
    editorRuntime
  })

  const { result: { errors } } = useCompilationState()
  const problems = useMemo(() => {
    return errors.map((error): Problem => ({
      kind: 'error',
      label: 'Compiler',
      message: error.message,
      range: error.range,
      error
    }))
  }, [errors])

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
      openFiles({ types: FILE_TYPES }).then(async (files) => {
        return files.length > 0 ? await readFileAsText(files[0]) : undefined
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

  useRegisterCommand(() => ({
    id: goToDefinitionId,
    label: 'Go to definition',
    keyboardShortcuts: [
      'F12'
    ],
    run: () => {
      const runtime = editorRef.current.editorRuntime
      const view = runtime.viewRef.current
      if (view == null) {
        return
      }

      const tree = syntaxTree(view.state)
      const caret = view.state.selection.main.head
      const target = applySemanticOperation(goToDefinition, tree, view.state.doc, caret)
      if (target == null) {
        view.focus()
        return
      }

      const selection = EditorSelection.single(target.offset)
      view.dispatch({ selection, scrollIntoView: true })
      view.focus()
    }
  }), [])

  useProvideProblems(problems)

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
