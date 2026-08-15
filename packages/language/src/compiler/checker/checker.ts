import { ast } from '@meyfa/cadence-ast'
import { CompoundError } from '../../result/errors.ts'
import type { Result } from '../../result/result.ts'
import type { FunctionSpec } from '../../type-system/base/function.ts'
import { MixerFacet } from '../../type-system/domain/mixer.ts'
import { TrackFacet } from '../../type-system/domain/track.ts'
import { nonNull } from '../assert.ts'
import { globalBuiltins } from '../builtins/global.ts'
import { CompileError } from '../error.ts'
import type { MutableEmissions, SlotName } from './emissions.ts'
import { addEmission, validateEmissions } from './emissions.ts'
import { checkImports } from './imports.ts'
import type { Binding } from './scopes.ts'
import { createGlobalScope, createLocalScope } from './scopes.ts'
import type { StatementOptions } from './statements.ts'
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
  const initialResolutions = new Map<string, Binding>(importResult.result)
  for (const [name, { type }] of globalBuiltins) {
    initialResolutions.set(name, { name, type, definite: true })
  }

  const globalScope = createGlobalScope(initialResolutions)
  const scope = createLocalScope(globalScope)

  const errors: CompileError[] = []

  const emissions: MutableEmissions = new Map()

  for (const child of program.children) {
    const statement = checkStatement(scope, child, programStatementOptions)
    errors.push(...statement.errors)

    for (const emission of statement.emissions.values()) {
      errors.push(...addEmission(emissions, emission))
    }

    if (statement.properties.size > 0) {
      errors.push(new CompileError('Cannot expose properties in the global scope', child.range))
    }
  }

  errors.push(...validateEmissions(emissions, programStatementOptions.slots ?? [], program.range))

  if (errors.length > 0) {
    return failure(errors)
  }

  const semantic: SemanticModel = {
    getFunctionSpec: (expression) => nonNull(scope.top.semantic.functions.get(expression))
  }

  return success({ ast: program, semantic })
}

const mixerSlotName = 'mixer' as SlotName
const trackSlotName = 'track' as SlotName

const programStatementOptions: StatementOptions = {
  context: 'program',
  slots: [
    {
      name: mixerSlotName,
      type: MixerFacet.type(),
      required: false,
      singular: true
    },
    {
      name: trackSlotName,
      type: TrackFacet.type(),
      required: false,
      singular: true
    }
  ]
}
