import { ast } from '@meyfa/cadence-ast'
import type { Value } from '../../../../type-system/types.ts'
import { nonNull } from '../../../assert.ts'
import { resolveInScope } from '../../../resolution.ts'
import type { Scope } from '../../scopes.ts'

export function generateIdentifier (scope: Scope, expression: ast.Identifier): Value {
  return nonNull(resolveInScope(scope, expression.name))
}
