import { ast } from '@meyfa/cadence-ast'
import { StringFacet } from '../../../../type-system/base/string.ts'
import type { Value } from '../../../../type-system/types.ts'
import type { Scope } from '../../scopes.ts'
import { resolve } from '../index.ts'

export function generateString (scope: Scope, expression: ast.String): Value {
  const resolvedParts = expression.parts.map((part) => {
    if (typeof part === 'string') {
      return part
    }

    return StringFacet.get(resolve(scope, part))
  })

  return StringFacet.type().of(resolvedParts.join(''))
}
