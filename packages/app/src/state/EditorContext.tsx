import type { EditorLocation } from '@editor/editor.js'
import { createContext, useReducer, type Dispatch, type FunctionComponent, type PropsWithChildren, type SetStateAction } from 'react'
import { useSafeContext } from '../hooks/context.js'

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

export const EditorContext = createContext<EditorState | undefined>(undefined)
export const EditorDispatchContext = createContext<EditorDispatch | undefined>(undefined)

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
  const state = useSafeContext(EditorContext, 'EditorContext')
  const dispatch = useSafeContext(EditorDispatchContext, 'EditorDispatchContext')

  return [state, dispatch]
}
