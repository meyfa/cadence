import { useDebouncedValue, useLatestRef, useProjectSource, useSafeContext } from '@editor'
import type { CompileOptions } from '@language'
import { numeric } from '@utility'
import { createContext, useCallback, useMemo, type FunctionComponent, type PropsWithChildren } from 'react'
import { compileSource, useCompiler, type CompileResult } from './compiler.js'

export interface CompilationState {
  readonly loading: boolean
  readonly result: CompileResult
  readonly compileNow: () => CompileResult
}

const CompilationContext = createContext<CompilationState | undefined>(undefined)

const COMPILE_DEBOUNCE = numeric('s', 0.25)

export const CompilationProvider: FunctionComponent<PropsWithChildren<{
  compileOptions: CompileOptions
}>> = ({ compileOptions, children }) => {
  const compileOptionsRef = useLatestRef(compileOptions)

  const source = useProjectSource()
  const sourceRef = useLatestRef(source)

  const compileNow = useCallback(() => {
    return compileSource(sourceRef.current, compileOptionsRef.current)
  }, [])

  const debouncedSource = useDebouncedValue(source, COMPILE_DEBOUNCE)

  const result = useCompiler(debouncedSource, compileOptions)

  const loading = debouncedSource !== source

  const value = useMemo(() => ({
    loading,
    result,
    compileNow
  }), [result, loading, compileNow])

  return (
    <CompilationContext value={value}>
      {children}
    </CompilationContext>
  )
}

export function useCompilationState (): CompilationState {
  return useSafeContext(CompilationContext, 'CompilationContext')
}
