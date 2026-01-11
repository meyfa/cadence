import type { CompileOptions } from '@language/compiler/compiler.js'
import { createContext, type FunctionComponent, type PropsWithChildren } from 'react'
import { useCompiler, type CompileResult } from '../hooks/compiler.js'
import { useSafeContext } from '../hooks/context.js'
import { useEditor } from './EditorContext.js'

export type CompilationState = CompileResult

export const CompilationContext = createContext<CompilationState | undefined>(undefined)

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
  return useSafeContext(CompilationContext, 'CompilationContext')
}
