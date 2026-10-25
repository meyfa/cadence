import { ast } from '@meyfa/cadence-ast'
import type { Value } from '../../../../type-system/types.ts'
import { toNumberValue } from '../../../units.ts'
import type { Scope } from '../../scopes.ts'

export function generateNumber (scope: Scope, expression: ast.Number): Value {
  return toNumberValue(scope.top.options, undefined, expression.value)
}
