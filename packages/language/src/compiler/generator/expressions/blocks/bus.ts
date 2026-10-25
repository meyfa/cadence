import { ast } from '@meyfa/cadence-ast'
import type { Effect, MixerSource } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { setAll } from '@meyfa/cadence-utility'
import { NumberFacet } from '../../../../type-system/base/number.ts'
import { StringFacet } from '../../../../type-system/base/string.ts'
import { BusFacet } from '../../../../type-system/domain/bus.ts'
import { EffectFacet } from '../../../../type-system/domain/effect.ts'
import { InstrumentFacet } from '../../../../type-system/domain/instrument.ts'
import { makeFacetType } from '../../../../type-system/factory.ts'
import { Parameters } from '../../../../type-system/helpers.ts'
import type { Value } from '../../../../type-system/types.ts'
import { fail } from '../../../assert.ts'
import { busSchema } from '../../../common.ts'
import { RecordBuilder } from '../../properties.ts'
import type { Scope } from '../../scopes.ts'
import { createLocalScope } from '../../scopes.ts'
import { processStatement } from '../../statements.ts'
import { resolveArgumentList } from '../arguments.ts'

export function generateBus (scope: Scope, expression: ast.Bus): Value {
  const args = resolveArgumentList(scope, expression.arguments, busSchema)
  const label = args.label != null ? StringFacet.get(args.label) : undefined

  const busScope = createLocalScope(scope)

  const recordBuilder = new RecordBuilder()
  const sources: MixerSource[] = []
  const effects: Effect[] = []

  // These must always be allocated even if not explicitly set,
  // as they could still be automated.
  const gainData = args.gain != null ? NumberFacet.get(args.gain).value : 0 as Numeric<'db'>
  const panData = args.pan != null ? NumberFacet.get(args.pan).value : 0 as Numeric<undefined>

  const gain = scope.top.allocateParameter('db', gainData)
  const pan = scope.top.allocateParameter(undefined, panData)
  recordBuilder.set('gain', Parameters.of(gain))
  recordBuilder.set('pan', Parameters.of(pan))

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(busScope, child)

    for (const emission of emissions) {
      if (InstrumentFacet.has(emission)) {
        sources.push({ type: 'instrument', id: InstrumentFacet.get(emission).id })
      } else if (BusFacet.has(emission)) {
        sources.push({ type: 'bus', id: BusFacet.get(emission).id })
      } else if (EffectFacet.has(emission)) {
        effects.push(EffectFacet.get(emission))
      } else {
        fail()
      }
    }

    setAll(recordBuilder, properties)
  }

  const bus = scope.top.allocateBus({ label, sources, gain, pan, effects })
  const value = makeFacetType(BusFacet, recordBuilder.facet).of(bus, recordBuilder.record)

  return value
}
