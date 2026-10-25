import { ast } from '@meyfa/cadence-ast'
import type { Type } from '../../../../type-system/types.ts'
import { CompileError } from '../../../error.ts'
import { unaryOperations } from '../../../operators/unary.ts'
import type { Scope } from '../../scopes.ts'
import { checkExpression } from '../index.ts'
import type { Checked } from '../types.ts'

export function checkUnaryExpression (scope: Scope, expression: ast.UnaryExpression): Checked<Type> {
  const operandCheck = checkExpression(scope, expression.operand)
  const errors = [...operandCheck.errors]
  const capabilities = operandCheck.capabilities

  const operand = operandCheck.result
  if (operand == null) {
    return { errors, capabilities }
  }

  const result = unaryOperations[expression.operator].check(operand)

  if (result == null) {
    errors.push(new CompileError(`Incompatible operand for "${expression.operator}": ${operand.format()}`, expression.range))
    return { errors, capabilities }
  }

  return { errors, capabilities, result }
}
