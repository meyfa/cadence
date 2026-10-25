import { ast } from '@meyfa/cadence-ast'
import { setAll } from '@meyfa/cadence-utility'
import type { Value } from '../../../../type-system/types.ts'
import { assert } from '../../../assert.ts'
import { RecordBuilder } from '../../properties.ts'
import type { Scope } from '../../scopes.ts'
import { createLocalScope } from '../../scopes.ts'
import { processStatement } from '../../statements.ts'

export function generateRecord (scope: Scope, expression: ast.RecordValue): Value {
  const recordScope = createLocalScope(scope)
  const recordBuilder = new RecordBuilder()

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(recordScope, child)
    assert(emissions.length === 0)
    setAll(recordBuilder, properties)
  }

  return recordBuilder.facet.type().of(recordBuilder.record)
}
