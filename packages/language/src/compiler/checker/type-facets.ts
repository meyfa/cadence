import type { Unit } from '@meyfa/cadence-utility'
import { NumberFacet } from '../../type-system/base/number.ts'
import { StringFacet } from '../../type-system/base/string.ts'
import { AutomationFacet } from '../../type-system/domain/automation.ts'
import { BusFacet } from '../../type-system/domain/bus.ts'
import { CurveFacet } from '../../type-system/domain/curve.ts'
import { EffectFacet } from '../../type-system/domain/effect.ts'
import { InstrumentFacet } from '../../type-system/domain/instrument.ts'
import { MixerFacet } from '../../type-system/domain/mixer.ts'
import { ParameterFacet } from '../../type-system/domain/parameter.ts'
import { PartFacet } from '../../type-system/domain/part.ts'
import { PatternFacet } from '../../type-system/domain/pattern.ts'
import { RoutingFacet } from '../../type-system/domain/routing.ts'
import { SourceFacet } from '../../type-system/domain/source.ts'
import { TrackFacet } from '../../type-system/domain/track.ts'
import { VoiceFacet } from '../../type-system/domain/voice.ts'
import type { Facet } from '../../type-system/types.ts'
import { isSyntaxUnit, toBaseUnit } from '../units.ts'

type FacetFactory = (generic: string | undefined) => Facet | undefined

export function getFacet (name: string, generic: string | undefined): Facet | undefined {
  return facets.get(name)?.(generic)
}

const facets: ReadonlyMap<string, FacetFactory> = new Map<string, FacetFactory>([
  // base facets

  ['number', createWithUnitGeneric(NumberFacet)],
  ['string', create(StringFacet)],

  // domain facets

  ['automation', create(AutomationFacet)],
  ['bus', create(BusFacet)],
  ['curve', createWithUnitGeneric(CurveFacet)],
  ['effect', create(EffectFacet)],
  ['instrument', create(InstrumentFacet)],
  ['mixer', create(MixerFacet)],
  ['parameter', createWithUnitGeneric(ParameterFacet)],
  ['part', create(PartFacet)],
  ['pattern', create(PatternFacet)],
  ['routing', create(RoutingFacet)],
  ['source', create(SourceFacet)],
  ['track', create(TrackFacet)],
  ['voice', create(VoiceFacet)]
])

function create (facet: Facet): FacetFactory {
  return (generic) => generic == null ? facet : undefined
}

function createWithUnitGeneric (facet: { readonly with: (unit: Unit) => Facet }): FacetFactory {
  return (generic) => {
    if (generic == null || isSyntaxUnit(generic)) {
      return facet.with(toBaseUnit(generic))
    }

    return undefined
  }
}
