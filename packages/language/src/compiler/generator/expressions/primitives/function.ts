import { ast } from '@meyfa/cadence-ast'
import type { Function } from '../../../../type-system/base/function.ts'
import { Functions } from '../../../../type-system/helpers.ts'
import type { Value } from '../../../../type-system/types.ts'
import { assert, nonNull } from '../../../assert.ts'
import type { Scope } from '../../scopes.ts'
import { cloneScope, createLocalScope } from '../../scopes.ts'
import { processStatement } from '../../statements.ts'

export function generateFunction (scope: Scope, expression: ast.Function): Value {
  const frozenScope: Scope = cloneScope(scope)

  const spec = scope.top.semantic.getFunctionSpec(expression)

  const invoke: Function['invoke'] = (_context, args) => {
    const callScope = createLocalScope(frozenScope)

    // Bind arguments to the call scope
    for (const [name, value] of Object.entries(args)) {
      assert(!callScope.resolutions.has(name))
      callScope.resolutions.set(name, value as Value)
    }

    let returnValue: Value | undefined

    for (const child of expression.children) {
      const { emissions } = processStatement(callScope, child)

      for (const emission of emissions) {
        assert(returnValue == null)
        returnValue = emission
      }
    }

    return nonNull(returnValue)
  }

  return Functions.of(spec, { invoke })
}
