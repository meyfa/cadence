import { ast } from '@meyfa/cadence-ast'
import { BooleanFacet } from '../../../../type-system/base/boolean.ts'
import type { Value } from '../../../../type-system/types.ts'
import type { Scope } from '../../scopes.ts'

export function generateBoolean (scope: Scope, expression: ast.Boolean): Value {
  return BooleanFacet.type().of(expression.value)
}
