import { ast } from '@meyfa/cadence-ast'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import { PatternFacet } from '../../../../type-system/domain/pattern.ts'
import type { Type } from '../../../../type-system/types.ts'
import { stepSchema } from '../../../common.ts'
import { CompileError } from '../../../error.ts'
import { mergeCapabilities, noCapabilities } from '../../capabilities.ts'
import type { Scope } from '../../scopes.ts'
import { checkArguments } from '../arguments.ts'
import { checkExpression } from '../index.ts'
import type { Checked } from '../types.ts'
import { expectType } from '../utilities.ts'

export function checkPattern (scope: Scope, expression: ast.Pattern): Checked<Type> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  for (const item of expression.children) {
    if (item.type === 'Step') {
      const stepCheck = checkStep(scope, item)
      errors.push(...stepCheck.errors)
      capabilities = mergeCapabilities(capabilities, stepCheck.capabilities)
      continue
    }

    const itemCheck = checkExpression(scope, item)
    errors.push(...itemCheck.errors)
    capabilities = mergeCapabilities(capabilities, itemCheck.capabilities)

    if (itemCheck.result != null) {
      errors.push(...expectType(PatternFacet.type(), itemCheck.result, item.range))
    }
  }

  return { errors, capabilities, result: PatternFacet.type() }
}

function checkStep (scope: Scope, expression: ast.Step): Checked<void> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  if (expression.length != null) {
    const lengthCheck = checkExpression(scope, expression.length)
    errors.push(...lengthCheck.errors)
    capabilities = mergeCapabilities(capabilities, lengthCheck.capabilities)

    if (lengthCheck.result != null) {
      errors.push(...expectType(NumberFacet.with(undefined).type(), lengthCheck.result, expression.length.range))
    }
  }

  const argumentListCheck = checkArguments(scope, expression.arguments, stepSchema, expression.range)
  errors.push(...argumentListCheck.errors)
  capabilities = mergeCapabilities(capabilities, argumentListCheck.capabilities)

  return { errors, capabilities }
}
