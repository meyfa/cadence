import * as ast from '../parser/ast.js'
import { CompoundError, type Result } from '../error.js'
import type { Program } from '../../core/program.js'
import { check as checkerCheck } from './checker.js'
import { generate, type GenerateOptions } from './generator.js'
import type { CompileError } from './error.js'

export type CompileOptions = GenerateOptions
export type CompileResult = Result<Program, CompoundError<CompileError>>

/**
 * Compile an AST into a runnable program. This includes semantic analysis followed by
 * synthesis of the program structure.
 */
export function compile (program: ast.Program, options: CompileOptions): CompileResult {
  const errors = check(program)
  if (errors.length > 0) {
    return {
      complete: false,
      error: new CompoundError('Compilation failed', errors)
    }
  }

  const generated = generate(program, options)

  return {
    complete: true,
    value: generated
  }
}

/**
 * Check an AST for semantic errors, but do not synthesize a compilation result.
 * This is more efficient than full compilation if you only need to check for errors.
 */
export function check (program: ast.Program): readonly CompileError[] {
  return checkerCheck(program)
}
