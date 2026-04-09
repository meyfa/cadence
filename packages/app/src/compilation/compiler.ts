import type { Program } from '@core'
import { compile, CompoundError, lex, parse, RangeError, Result, type CompileOptions } from '@language'
import { useMemo } from 'react'
import { getProjectFileContent, TRACK_FILE_PATH, type ProjectSourceState } from '../project-source/model.js'

type UnwrappableError = RangeError | CompoundError<RangeError>

class CompileHookError extends RangeError {
  constructor (message: string) {
    super(message)
    this.name = 'CompileHookError'
  }
}

function createSafeFunction<TArgs extends unknown[], TValue, TError extends UnwrappableError> (
  fn: (...args: TArgs) => Result<TValue, TError>
): (...args: TArgs) => Result<TValue, UnwrappableError> {
  return (...args) => {
    try {
      return fn(...args)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Unexpected error in compile hook:', err)

      if (err instanceof RangeError || err instanceof CompoundError) {
        return { complete: false, error: err }
      }

      const error = new CompileHookError('Unexpected error during compilation')
      if (err instanceof Error) {
        error.cause = err
      }

      return { complete: false, error }
    }
  }
}

function unwrapError (error: UnwrappableError): readonly RangeError[] {
  if (error instanceof CompoundError) {
    return error.errors.flatMap(unwrapError)
  }

  return [error]
}

const safeLex = createSafeFunction(lex)
const safeParse = createSafeFunction(parse)
const safeCompile = createSafeFunction(compile)

export interface CompileResult {
  readonly program?: Program
  readonly errors: readonly RangeError[]
}

export function compileSource (source: ProjectSourceState, compileOptions: CompileOptions): CompileResult {
  const code = getProjectFileContent(source, TRACK_FILE_PATH) ?? ''

  const lexResult = safeLex(code)
  if (!lexResult.complete) {
    return { errors: unwrapError(lexResult.error) }
  }

  const parseResult = safeParse(lexResult.value)
  if (!parseResult.complete) {
    return { errors: unwrapError(parseResult.error) }
  }

  const compileResult = safeCompile(parseResult.value, compileOptions)
  if (!compileResult.complete) {
    return { errors: unwrapError(compileResult.error) }
  }

  return {
    program: compileResult.value,
    errors: []
  }
}

export function useCompiler (source: ProjectSourceState, compileOptions: CompileOptions): CompileResult {
  return useMemo(() => compileSource(source, compileOptions), [source, compileOptions])
}
