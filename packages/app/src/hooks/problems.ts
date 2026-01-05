import { useMemo } from 'react'
import { useAudioEngine } from '../state/AudioEngineContext.js'
import { useCompilationState } from '../state/CompilationContext.js'
import { useObservable } from './observable.js'
import { RangeError } from '@language/error.js'

export interface Problem {
  readonly error: RangeError | Error
  readonly source: 'compiler' | 'playback'
}

function toProblem (error: Problem['error'], source: Problem['source']): Problem {
  return { error, source }
}

export function useProblems (): readonly Problem[] {
  const { errors: compileErrors } = useCompilationState()

  const engine = useAudioEngine()
  const runtimeErrors = useObservable(engine.errors)

  return useMemo(() => {
    return [
      ...compileErrors.map((error) => toProblem(error, 'compiler')),
      ...runtimeErrors.map((error) => toProblem(error, 'playback'))
    ]
  }, [compileErrors, runtimeErrors])
}
