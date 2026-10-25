import { ast } from '@meyfa/cadence-ast'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import { RecordFacet } from '../../../../type-system/base/record.ts'
import { PatternFacet } from '../../../../type-system/domain/pattern.ts'
import type { Value } from '../../../../type-system/types.ts'
import { assert, fail, nonNull } from '../../../assert.ts'
import { patternBuiltins } from '../../../builtins/patterns.ts'
import { isSyntaxUnit, toNumberValue } from '../../../units.ts'
import type { Scope } from '../../scopes.ts'
import { resolve } from '../index.ts'

export function generatePropertyAccess (scope: Scope, expression: ast.PropertyAccess): Value {
  const object = resolve(scope, expression.object)
  const property = expression.property.name

  if (NumberFacet.has(object)) {
    assert(isSyntaxUnit(property))
    const numberData = NumberFacet.get(object)
    return toNumberValue(scope.top.options, property, numberData.value)
  }

  if (PatternFacet.has(object)) {
    const builtin = patternBuiltins.get(property)
    if (builtin != null) {
      return builtin.bind(PatternFacet.get(object))
    }
  }

  if (RecordFacet.has(object)) {
    const record = RecordFacet.get(object)
    return nonNull(Object.hasOwn(record, property) ? record[property] : undefined)
  }

  fail()
}
