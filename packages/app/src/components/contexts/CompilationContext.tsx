import { useSafeContext } from '@editor'
import type { CompileOptions } from '@language'
import { createContext, type FunctionComponent, type PropsWithChildren } from 'react'
import { useCompiler, type CompileResult } from '../../hooks/compiler.js'
import { useProjectSource } from '../../project-source/ProjectSourceContext.js'

export type CompilationState = CompileResult

const CompilationContext = createContext<CompilationState | undefined>(undefined)

export const CompilationProvider: FunctionComponent<PropsWithChildren<{
  compileOptions: CompileOptions
}>> = ({ compileOptions, children }) => {
  const source = useProjectSource()
  const result = useCompiler(source, compileOptions)

  return (
    <CompilationContext value={result}>
      {children}
    </CompilationContext>
  )
}

export function useCompilationState (): CompilationState {
  return useSafeContext(CompilationContext, 'CompilationContext')
}
