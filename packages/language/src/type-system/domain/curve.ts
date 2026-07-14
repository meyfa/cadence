import type { RelativeCurve } from '@meyfa/cadence-core'
import type { Unit } from '@meyfa/cadence-utility'
import { makeFacet } from '../factory.ts'
import type { Facet, FacetType } from '../types.ts'

const FACET_NAME = 'curve'

const cache = new Map<Unit, Facet<typeof FACET_NAME, RelativeCurve<Unit>>>()

export const CurveFacet = {
  ...makeFacet<typeof FACET_NAME, RelativeCurve<Unit>>(FACET_NAME, {}),

  with: <const U extends Unit> (unit: U) => {
    let cached = cache.get(unit) as Facet<typeof FACET_NAME, RelativeCurve<U>> | undefined

    if (cached == null) {
      cached = makeFacet<typeof FACET_NAME, RelativeCurve<U>>(FACET_NAME, { unit }, {
        format: () => unit == null ? FACET_NAME : `${FACET_NAME}(${unit})`
      })
      cache.set(unit, cached)
    }

    return cached
  },

  detail: (type: FacetType): Unit => {
    const { generics } = type.getFacet(FACET_NAME)
    if (!('unit' in generics)) {
      throw new Error(`Invalid generics for ${FACET_NAME} facet`)
    }

    return generics.unit as Unit
  }
}
