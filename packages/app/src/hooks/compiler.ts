import { useMemo } from 'react'
import { lex } from '@language/lexer/lexer.js'
import { parse } from '@language/parser/parser.js'
import { compile, type CompileOptions } from '@language/compiler/compiler.js'
import type { Program } from '@core/program.js'
import type { RangeError } from '@language/error.js'

export interface CompileResult {
  readonly program?: Program
  readonly errors: readonly RangeError[]
}

export function useCompiler (code: string, compileOptions: CompileOptions): CompileResult {
  const lexResult = useMemo(() => lex(code), [code])

  const parseResult = useMemo(() => {
    if (lexResult.complete) {
      return parse(lexResult.value)
    }
  }, [lexResult])

  const compileResult = useMemo(() => {
    if (parseResult?.complete === true) {
      return compile(parseResult.value, compileOptions)
    }
  }, [parseResult, compileOptions])

  const errors = useMemo(() => {
    if (!lexResult.complete) {
      return [lexResult.error]
    }
    if (parseResult?.complete === false) {
      return [parseResult.error]
    }
    if (compileResult?.complete === false) {
      return compileResult.error.errors
    }
    return []
  }, [parseResult, compileResult])

  const program = compileResult?.complete === true ? compileResult.value : undefined

  return useMemo(() => ({ program, errors }), [program, errors])
}
