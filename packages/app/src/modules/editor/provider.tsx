import type { EditorView } from '@codemirror/view'
import type { EditorLocation, TabId } from '@editor'
import { useSafeContext } from '@editor'
import type { Dispatch, FunctionComponent, PropsWithChildren, RefObject, SetStateAction } from 'react'
import { createContext, useReducer, useRef } from 'react'

export interface EditorState {
  readonly carets: Readonly<Record<TabId, EditorLocation | undefined>>
}

export interface EditorRuntimeState {
  readonly viewRef: RefObject<EditorView | undefined>
}

const initialEditorState: EditorState = {
  carets: {}
}

function editorReducer (state: EditorState, action: SetStateAction<EditorState>): EditorState {
  return typeof action === 'function' ? action(state) : action
}

export type EditorDispatch = Dispatch<SetStateAction<EditorState>>

const EditorContext = createContext<EditorState | undefined>(undefined)
const EditorDispatchContext = createContext<EditorDispatch | undefined>(undefined)
const EditorRuntimeContext = createContext<EditorRuntimeState | undefined>(undefined)

export const EditorProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState)
  const viewRef = useRef<EditorView | undefined>(undefined)

  return (
    <EditorContext value={state}>
      <EditorDispatchContext value={dispatch}>
        <EditorRuntimeContext value={{ viewRef }}>
          {children}
        </EditorRuntimeContext>
      </EditorDispatchContext>
    </EditorContext>
  )
}

export function useEditor (): EditorState {
  return useSafeContext(EditorContext, 'EditorContext')
}

export function useEditorDispatch (): EditorDispatch {
  return useSafeContext(EditorDispatchContext, 'EditorDispatchContext')
}

export function useEditorRuntime (): EditorRuntimeState {
  return useSafeContext(EditorRuntimeContext, 'EditorRuntimeContext')
}
