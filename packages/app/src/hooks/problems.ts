import { RangeError } from '@language'
import { useMemo } from 'react'
import { useAudioEngine } from '../components/contexts/AudioEngineContext.js'
import { useCompilationState } from '../components/contexts/CompilationContext.js'
import { useObservable } from './observable.js'

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
