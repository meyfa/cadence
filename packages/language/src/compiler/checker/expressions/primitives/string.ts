import { ast } from '@meyfa/cadence-ast'
import { StringFacet } from '../../../../type-system/base/string.ts'
import type { Type } from '../../../../type-system/types.ts'
import { CompileError } from '../../../error.ts'
import { mergeCapabilities, noCapabilities } from '../../capabilities.ts'
import type { Scope } from '../../scopes.ts'
import { checkExpression } from '../index.ts'
import type { Checked } from '../types.ts'
import { expectType } from '../utilities.ts'

export function checkString (scope: Scope, expression: ast.String): Checked<Type> {
  const errors: CompileError[] = []
  let capabilities = noCapabilities

  for (const part of expression.parts) {
    if (typeof part === 'string') {
      continue
    }

    const partCheck = checkExpression(scope, part)
    errors.push(...partCheck.errors)
    capabilities = mergeCapabilities(capabilities, partCheck.capabilities)

    if (partCheck.result != null) {
      errors.push(...expectType(StringFacet.type(), partCheck.result, part.range))
    }
  }

  return { errors, capabilities, result: StringFacet.type() }
}
