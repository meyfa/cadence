import { useDebouncedValue, useLatestRef, useProjectSource, useSafeContext } from '@meyfa/cadence-editor'
import type { GenerateOptions } from '@meyfa/cadence-language'
import type { Numeric } from '@meyfa/cadence-utility'
import type { FunctionComponent, PropsWithChildren } from 'react'
import { createContext, useCallback, useMemo } from 'react'
import type { CompileResult } from './compiler.ts'
import { compileSource, useCompiler } from './compiler.ts'

export interface CompilationState {
  readonly loading: boolean
  readonly result: CompileResult
  readonly compileNow: () => CompileResult
}

const CompilationContext = createContext<CompilationState | undefined>(undefined)

const COMPILE_DEBOUNCE = 0.25 as Numeric<'s'>

export const CompilationProvider: FunctionComponent<PropsWithChildren<{
  compileOptions: GenerateOptions
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
