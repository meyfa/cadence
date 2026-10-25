import { ast } from '@meyfa/cadence-ast'
import type { Automation, InstrumentRouting } from '@meyfa/cadence-core'
import { setAll } from '@meyfa/cadence-utility'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import { StringFacet } from '../../../../type-system/base/string.ts'
import { AutomationFacet } from '../../../../type-system/domain/automation.ts'
import { PartFacet } from '../../../../type-system/domain/part.ts'
import { RoutingFacet } from '../../../../type-system/domain/routing.ts'
import { makeFacetType } from '../../../../type-system/factory.ts'
import type { Value } from '../../../../type-system/types.ts'
import { fail } from '../../../assert.ts'
import { partSchema } from '../../../common.ts'
import { RecordBuilder } from '../../properties.ts'
import type { Scope } from '../../scopes.ts'
import { createLocalScope } from '../../scopes.ts'
import { processStatement } from '../../statements.ts'
import { resolveArgumentList } from '../arguments.ts'
import { clamped } from '../utilities.ts'

export function generatePart (scope: Scope, expression: ast.Part): Value {
  const args = resolveArgumentList(scope, expression.arguments, partSchema)
  const label = args.label != null ? StringFacet.get(args.label) : undefined
  const length = clamped(NumberFacet.get(args.length), 0, Number.POSITIVE_INFINITY)

  const partScope = createLocalScope(scope)

  const recordBuilder = new RecordBuilder()
  const routings: InstrumentRouting[] = []
  const automations: Automation[] = []

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(partScope, child)

    for (const emission of emissions) {
      if (RoutingFacet.has(emission)) {
        routings.push(RoutingFacet.get(emission))
      } else if (AutomationFacet.has(emission)) {
        automations.push(AutomationFacet.get(emission))
      } else {
        fail()
      }
    }

    setAll(recordBuilder, properties)
  }

  const part = { label, length: length.value, routings, automations }

  return !recordBuilder.empty
    ? makeFacetType(PartFacet, recordBuilder.facet).of(part, recordBuilder.record)
    : PartFacet.type().of(part)
}
