import { ast } from '@meyfa/cadence-ast'
import type { Value } from '../../../../type-system/types.ts'
import { unaryOperations } from '../../../operators/unary.ts'
import type { Scope } from '../../scopes.ts'
import { resolve } from '../index.ts'

export function generateUnaryExpression (scope: Scope, expression: ast.UnaryExpression): Value {
  return unaryOperations[expression.operator].compute(
    resolve(scope, expression.operand)
  )
}
