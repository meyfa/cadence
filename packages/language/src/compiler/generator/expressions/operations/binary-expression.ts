import { ast } from '@meyfa/cadence-ast'
import type { Value } from '../../../../type-system/types.ts'
import { binaryOperations } from '../../../operators/binary.ts'
import type { Scope } from '../../scopes.ts'
import { resolve } from '../index.ts'

export function generateBinaryExpression (scope: Scope, expression: ast.BinaryExpression): Value {
  return binaryOperations[expression.operator].compute(
    resolve(scope, expression.left),
    resolve(scope, expression.right)
  )
}
