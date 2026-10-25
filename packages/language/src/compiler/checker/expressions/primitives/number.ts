import { ast } from '@meyfa/cadence-ast'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import type { Type } from '../../../../type-system/types.ts'
import { noCapabilities } from '../../capabilities.ts'
import type { Scope } from '../../scopes.ts'
import type { Checked } from '../types.ts'

export function checkNumber (scope: Scope, expression: ast.Number): Checked<Type> {
  return { errors: [], capabilities: noCapabilities, result: NumberFacet.with(undefined).type() }
}
