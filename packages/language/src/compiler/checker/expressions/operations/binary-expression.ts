import { ast } from '@meyfa/cadence-ast'
import type { Type } from '../../../../type-system/types.ts'
import { CompileError } from '../../../error.ts'
import { binaryOperations } from '../../../operators/binary.ts'
import { mergeCapabilities } from '../../capabilities.ts'
import type { Scope } from '../../scopes.ts'
import { checkExpression } from '../index.ts'
import type { Checked } from '../types.ts'

export function checkBinaryExpression (scope: Scope, expression: ast.BinaryExpression): Checked<Type> {
  const leftCheck = checkExpression(scope, expression.left)
  const rightCheck = checkExpression(scope, expression.right)

  const errors = [...leftCheck.errors, ...rightCheck.errors]
  const capabilities = mergeCapabilities(leftCheck.capabilities, rightCheck.capabilities)

  const left = leftCheck.result
  const right = rightCheck.result

  if (left == null || right == null) {
    return { errors, capabilities }
  }

  const result = binaryOperations[expression.operator].check(left, right)

  if (result == null) {
    errors.push(new CompileError(`Incompatible operands for "${expression.operator}": ${left.format()}, ${right.format()}`, expression.range))
    return { errors, capabilities }
  }

  return { errors, capabilities, result }
}
