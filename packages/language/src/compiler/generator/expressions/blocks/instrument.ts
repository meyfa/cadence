import { ast } from '@meyfa/cadence-ast'
import type { Voice } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { setAll } from '@meyfa/cadence-utility'
import { StringFacet } from '../../../../type-system/base/string.ts'
import { InstrumentFacet } from '../../../../type-system/domain/instrument.ts'
import { VoiceFacet } from '../../../../type-system/domain/voice.ts'
import { makeFacetType } from '../../../../type-system/factory.ts'
import type { Value } from '../../../../type-system/types.ts'
import { instrumentSchema } from '../../../common.ts'
import { RecordBuilder } from '../../properties.ts'
import type { Scope } from '../../scopes.ts'
import { createLocalScope } from '../../scopes.ts'
import { processStatement } from '../../statements.ts'
import { resolveArgumentList } from '../arguments.ts'

export function generateInstrument (scope: Scope, expression: ast.Instrument): Value {
  const instrumentScope = createLocalScope(scope)

  const args = resolveArgumentList(scope, expression.arguments, instrumentSchema)
  const label = args.label != null ? StringFacet.get(args.label) : undefined

  const recordBuilder = new RecordBuilder()
  const voices: Voice[] = []

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(instrumentScope, child)
    for (const emission of emissions) {
      voices.push(VoiceFacet.get(emission))
    }
    setAll(recordBuilder, properties)
  }

  const gainParameter = scope.top.allocateParameter('db', 0 as Numeric<'db'>)
  const instrument = scope.top.allocateInstrument({ label, gain: gainParameter, voices })

  return !recordBuilder.empty
    ? makeFacetType(InstrumentFacet, recordBuilder.facet).of(instrument, recordBuilder.record)
    : InstrumentFacet.type().of(instrument)
}
