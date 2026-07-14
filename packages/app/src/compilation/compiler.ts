import type { Program } from '@meyfa/cadence-core'
import type { ProjectSource } from '@meyfa/cadence-editor'
import { getProjectFileContent } from '@meyfa/cadence-editor'
import type { CheckedProgram, GenerateOptions } from '@meyfa/cadence-language'
import { check, CompoundError, generate, lex, parse, RangeError, Result } from '@meyfa/cadence-language'
import { useMemo } from 'react'
import { TRACK_FILE_PATH } from '../persistence/constants.js'

type UnwrappableError = RangeError | CompoundError<RangeError>

class CompileHookError extends RangeError {
  constructor (message: string) {
    super(message)
    this.name = 'CompileHookError'
  }
}

function createSafeFunction<TArgs extends unknown[], TValue> (
  fn: (...args: TArgs) => Result<TValue, UnwrappableError>
): (...args: TArgs) => Result<TValue, UnwrappableError> {
  return (...args) => {
    try {
      return fn(...args)
    } catch (err: unknown) {
      return { complete: false, error: handleException(err) }
    }
  }
}

function handleException (err: unknown): UnwrappableError {
  // eslint-disable-next-line no-console
  console.error('Unexpected error in compile hook:', err)

  if (err instanceof RangeError || err instanceof CompoundError) {
    return err
  }

  const error = new CompileHookError('Unexpected error during compilation')
  if (err instanceof Error) {
    error.cause = err
  }

  return error
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

function safeGenerate (program: CheckedProgram, options: GenerateOptions): Result<Program, UnwrappableError> {
  try {
    return { complete: true, value: generate(program, options) }
  } catch (err: unknown) {
    return { complete: false, error: handleException(err) }
  }
}

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

  const generateResult = safeGenerate(checkResult.value, compileOptions)
  if (!generateResult.complete) {
    return { errors: unwrapError(generateResult.error) }
  }

  return {
    program: generateResult.value,
    errors: []
  }
}

export function useCompiler (source: ProjectSource, compileOptions: GenerateOptions): CompileResult {
  return useMemo(() => compileSource(source, compileOptions), [source, compileOptions])
}
