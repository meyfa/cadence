import { ast } from '@meyfa/cadence-ast'
import { BooleanFacet } from '../../../../type-system/base/boolean.ts'
import type { Type } from '../../../../type-system/types.ts'
import { noCapabilities } from '../../capabilities.ts'
import type { Scope } from '../../scopes.ts'
import type { Checked } from '../types.ts'

export function checkBoolean (scope: Scope, expression: ast.Boolean): Checked<Type> {
  return { errors: [], capabilities: noCapabilities, result: BooleanFacet.type() }
}
