import { ast } from '@meyfa/cadence-ast'
import type { Bus, MixerRouting } from '@meyfa/cadence-core'
import { setAll } from '@meyfa/cadence-utility'
import { BusFacet } from '../../../../type-system/domain/bus.ts'
import { MixerFacet } from '../../../../type-system/domain/mixer.ts'
import { makeFacetType } from '../../../../type-system/factory.ts'
import type { Value } from '../../../../type-system/types.ts'
import { RecordBuilder } from '../../properties.ts'
import type { Scope } from '../../scopes.ts'
import { createLocalScope } from '../../scopes.ts'
import { processStatement } from '../../statements.ts'

export function generateMixer (scope: Scope, expression: ast.Mixer): Value {
  const mixerScope = createLocalScope(scope)

  const recordBuilder = new RecordBuilder()
  const buses: Bus[] = []
  const routings: MixerRouting[] = []

  for (const child of expression.children) {
    const { emissions, properties } = processStatement(mixerScope, child)

    for (const emission of emissions) {
      const bus = BusFacet.get(emission)
      buses.push(bus)

      const destination = { type: 'bus', id: bus.id } as const
      routings.push(...bus.sources.map((source) => ({
        implicit: false,
        source,
        destination
      })))
    }

    setAll(recordBuilder, properties)
  }

  const mixer = { buses, routings }

  return !recordBuilder.empty
    ? makeFacetType(MixerFacet, recordBuilder.facet).of(mixer, recordBuilder.record)
    : MixerFacet.type().of(mixer)
}
