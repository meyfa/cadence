import type { CompileOptions } from '@language/compiler/compiler.js'
import { createContext, useContext, type FunctionComponent, type PropsWithChildren } from 'react'
import { useCompiler, type CompileResult } from '../hooks/compiler.js'
import { useEditor } from './EditorContext.js'

export type CompilationState = CompileResult

const initialCompilationState: CompilationState = {
  program: undefined,
  errors: []
}

export const CompilationContext = createContext<CompilationState>(initialCompilationState)

export const CompilationProvider: FunctionComponent<PropsWithChildren<{
  compileOptions: CompileOptions
}>> = ({ compileOptions, children }) => {
  const [editor] = useEditor()
  const result = useCompiler(editor.code, compileOptions)

  return (
    <CompilationContext value={result}>
      {children}
    </CompilationContext>
  )
}

export function useCompilationState (): CompilationState {
  return useContext(CompilationContext)
}
