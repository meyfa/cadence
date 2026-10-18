import { syntaxTree } from '@codemirror/language'
import { EditorSelection } from '@codemirror/state'
import type { Command, CommandId, LayoutDispatch, ProjectSource, ProjectSourceDispatch, ShowDialog } from '@meyfa/cadence-editor'
import { activateTabOfType, getProjectFileContent, setProjectFileContent, useLatestRef, useProjectSource, useProjectSourceDispatch } from '@meyfa/cadence-editor'
import { applySemanticOperation, goToDefinition } from '@meyfa/cadence-language-support'
import type { RefObject } from 'react'
import { TRACK_FILE_PATH } from '../../persistence/constants.ts'
import { openFiles, readFileAsText, saveTextFile } from '../../utilities/files.ts'
import { LoadDemoDialog } from './components/LoadDemoDialog.tsx'
import { editorPanelId, moduleId } from './ids.ts'
import type { EditorPanelProps } from './panel-props.ts'
import type { EditorDispatch, EditorRuntimeState } from './provider.tsx'
import { useEditorDispatch, useEditorRuntime } from './provider.tsx'

const DEFAULT_FILENAME = TRACK_FILE_PATH
const FILE_TYPES = [
  {
    description: 'Cadence files',
    accept: {
      'text/plain': ['.cadence']
    }
  }
]

interface Editor {
  readonly source: ProjectSource
  readonly sourceDispatch: ProjectSourceDispatch
  readonly editorDispatch: EditorDispatch
  readonly editorRuntime: EditorRuntimeState
}

type EditorRef = Readonly<RefObject<Editor>>

export function useEditorRef (): EditorRef {
  const source = useProjectSource()
  const sourceDispatch = useProjectSourceDispatch()
  const editorDispatch = useEditorDispatch()
  const editorRuntime = useEditorRuntime()

  return useLatestRef({
    source,
    sourceDispatch,
    editorDispatch,
    editorRuntime
  })
}

export const viewEditorId = `${moduleId}.view.editor` as CommandId
export const fileOpenId = `${moduleId}.file.open` as CommandId
export const fileSaveId = `${moduleId}.file.save` as CommandId
export const loadDemoId = `${moduleId}.load-demo` as CommandId
export const goToDefinitionId = `${moduleId}.go-to-definition` as CommandId

export function createShowEditorCommand (layoutDispatch: LayoutDispatch): Command {
  return {
    id: viewEditorId,
    label: 'Show view: Editor',
    run: () => {
      layoutDispatch((layout) => activateTabOfType(layout, editorPanelId, () => ({
        type: editorPanelId,
        props: { filePath: TRACK_FILE_PATH } satisfies EditorPanelProps
      })))
    }
  }
}

export function createFileOpenCommand (editorRef: EditorRef): Command {
  return {
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
  }
}

export function createFileSaveCommand (editorRef: EditorRef): Command {
  return {
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
  }
}

export function createLoadDemoCommand (showDialog: ShowDialog): Command {
  return {
    id: loadDemoId,
    label: 'File: Load demo project',
    run: () => {
      showDialog(LoadDemoDialog, { editorPanelId })
    }
  }
}

export function createGoToDefinitionCommand (editorRef: EditorRef): Command {
  return {
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

      const target = applySemanticOperation(goToDefinition, tree, view.state.doc, caret)?.binding
      if (target == null) {
        view.focus()
        return
      }

      const selection = EditorSelection.single(target.range.offset)
      view.dispatch({ selection, scrollIntoView: true })
      view.focus()
    }
  }
}
