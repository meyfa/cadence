import type { EditorLocation } from '@editor/editor.js'
import { createContext, useContext, useReducer, type Dispatch, type FunctionComponent, type PropsWithChildren, type SetStateAction } from 'react'

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

export const EditorContext = createContext<EditorState>(initialEditorState)
export const EditorDispatchContext = createContext<EditorDispatch>(undefined as any)

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

export function useEditor (): [EditorState, EditorDispatch] {
  const state = useContext(EditorContext)
  const dispatch = useContext(EditorDispatchContext)

  return [state, dispatch]
}
