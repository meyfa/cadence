import { ast } from '@meyfa/cadence-ast'
import type { Function } from '../../../../type-system/base/function.ts'
import { FunctionFacet } from '../../../../type-system/base/function.ts'
import type { Schema } from '../../../../type-system/schema.ts'
import type { Type, Value } from '../../../../type-system/types.ts'
import type { GlobalScope, Scope } from '../../scopes.ts'
import { resolveArgumentList } from '../arguments.ts'
import { resolve } from '../index.ts'

export function generateCall (scope: Scope, expression: ast.Call): Value {
  // cast due to context type
  const func = FunctionFacet.get(resolve(scope, expression.callee)) as Function<Schema, Type, GlobalScope>
  const args = resolveArgumentList(scope, expression.arguments, func.parameters)

  return func.invoke(scope.top, args)
}
