import type { EditorLocation } from '@editor'
import { useSafeContext } from '@editor'
import { createContext, useReducer, type Dispatch, type FunctionComponent, type PropsWithChildren, type SetStateAction } from 'react'

export interface EditorState {
  readonly code: string
  readonly caret?: EditorLocation
}

const initialEditorState: EditorState = {
  code: '',
  caret: undefined
}

function editorReducer (state: EditorState, action: SetStateAction<EditorState>): EditorState {
  return typeof action === 'function' ? action(state) : action
}

export type EditorDispatch = Dispatch<SetStateAction<EditorState>>

const EditorContext = createContext<EditorState | undefined>(undefined)
const EditorDispatchContext = createContext<EditorDispatch | undefined>(undefined)

export const EditorProvider: FunctionComponent<PropsWithChildren> = ({ children }) => {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState)

  return (
    <EditorContext value={state}>
      <EditorDispatchContext value={dispatch}>
        {children}
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
