import type { Program } from '@core/program.js'
import { compile, type CompileOptions } from '@language/compiler/compiler.js'
import { CompoundError, RangeError, Result } from '@language/error.js'
import { lex } from '@language/lexer/lexer.js'
import { parse } from '@language/parser/parser.js'
import { useMemo } from 'react'

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

export function useCompiler (code: string, compileOptions: CompileOptions): CompileResult {
  const lexResult = useMemo(() => safeLex(code), [code])

  const parseResult = useMemo(() => {
    if (lexResult.complete) {
      return safeParse(lexResult.value)
    }
  }, [lexResult])

  const compileResult = useMemo(() => {
    if (parseResult?.complete === true) {
      return safeCompile(parseResult.value, compileOptions)
    }
  }, [parseResult, compileOptions])

  const errors = useMemo(() => {
    if (!lexResult.complete) {
      return unwrapError(lexResult.error)
    }
    if (parseResult?.complete === false) {
      return unwrapError(parseResult.error)
    }
    if (compileResult?.complete === false) {
      return unwrapError(compileResult.error)
    }
    return []
  }, [parseResult, compileResult])

  const program = compileResult?.complete === true ? compileResult.value : undefined

  return useMemo(() => ({ program, errors }), [program, errors])
}
