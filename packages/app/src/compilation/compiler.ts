import { getProjectFileContent, type ProjectSource } from '@editor'
import type { Program } from '@core'
import type { GenerateOptions } from '@language'
import { check, CompoundError, generate, lex, parse, RangeError, Result } from '@language'
import { useMemo } from 'react'
import { TRACK_FILE_PATH } from '../persistence/constants.js'

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
const safeCheck = createSafeFunction(check)

export interface CompileResult {
  readonly program?: Program
  readonly errors: readonly RangeError[]
}

export function compileSource (source: ProjectSource, compileOptions: GenerateOptions): CompileResult {
  const entrypointPath = TRACK_FILE_PATH
  const code = getProjectFileContent(source, entrypointPath) ?? ''

  const lexResult = safeLex(code, entrypointPath)
  if (!lexResult.complete) {
    return { errors: unwrapError(lexResult.error) }
  }

  const parseResult = safeParse(lexResult.value)
  if (!parseResult.complete) {
    return { errors: unwrapError(parseResult.error) }
  }

  const checkResult = safeCheck(parseResult.value)
  if (!checkResult.complete) {
    return { errors: unwrapError(checkResult.error) }
  }

  return {
    program: generate(checkResult.value, compileOptions),
    errors: []
  }
}

export function useCompiler (source: ProjectSource, compileOptions: GenerateOptions): CompileResult {
  return useMemo(() => compileSource(source, compileOptions), [source, compileOptions])
}
