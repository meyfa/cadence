import { ast } from '@meyfa/cadence-ast'
import { CompoundError } from '../../result/errors.ts'
import type { Result } from '../../result/result.ts'
import type { FunctionSpec } from '../../type-system/base/function.ts'
import { MixerFacet } from '../../type-system/domain/mixer.ts'
import { TrackFacet } from '../../type-system/domain/track.ts'
import type { FacetType } from '../../type-system/types.ts'
import { nonNull } from '../assert.ts'
import { globalBuiltins } from '../builtins/global.ts'
import { CompileError } from '../error.ts'
import { checkImports } from './imports.ts'
import { createGlobalScope, createLocalScope } from './scopes.ts'
import { checkStatement } from './statements.ts'

export interface SemanticModel {
  readonly getFunctionSpec: (expression: ast.Function) => FunctionSpec
}

export interface CheckedProgram {
  readonly ast: ast.Program
  readonly semantic: SemanticModel
}

export type CheckResult = Result<CheckedProgram, CompoundError<CompileError>>

const success = (program: CheckedProgram): CheckResult => ({
  complete: true,
  value: program
})

const failure = (errors: readonly CompileError[]): CheckResult => ({
  complete: false,
  error: new CompoundError('Program has errors', errors)
})

export function check (program: ast.Program): CheckResult {
  const importResult = checkImports(program.imports)
  if (importResult.errors.length > 0) {
    return failure(importResult.errors)
  }

  // global builtins win over imported names
  const initialResolutions = new Map<string, FacetType>(importResult.result)
  for (const [name, value] of globalBuiltins) {
    initialResolutions.set(name, value.type)
  }

  const globalScope = createGlobalScope(initialResolutions)
  const scope = createLocalScope(globalScope)

  const errors: CompileError[] = []

  let hasTrack = false
  let hasMixer = false

  for (const child of program.children) {
    const statement = checkStatement(scope, child)
    errors.push(...statement.errors)

    if (statement.properties.size > 0) {
      errors.push(new CompileError('Cannot expose properties in the global scope', child.range))
    }

    for (const emission of statement.emissions) {
      if (MixerFacet.is(emission.type)) {
        if (hasMixer) {
          errors.push(new CompileError('Multiple mixers', emission.range))
        }
        hasMixer = true
        continue
      }

      if (TrackFacet.is(emission.type)) {
        if (hasTrack) {
          errors.push(new CompileError('Multiple tracks', emission.range))
        }
        hasTrack = true
        continue
      }

      errors.push(new CompileError(`Unexpected type ${emission.type.format()}, expected track or mixer`, emission.range))
    }
  }

  if (errors.length > 0) {
    return failure(errors)
  }

  const semantic: SemanticModel = {
    getFunctionSpec: (expression) => nonNull(scope.top.semantic.functions.get(expression))
  }

  return success({ ast: program, semantic })
}
