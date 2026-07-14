import type { RuntimeNumeric, Unit } from '@meyfa/cadence-utility'
import { makeFacet } from '../factory.js'
import type { Facet, FacetType } from '../types.js'

const FACET_NAME = 'number'

const cache = new Map<Unit, Facet<typeof FACET_NAME, RuntimeNumeric<Unit>>>()

export const NumberFacet = {
  ...makeFacet<typeof FACET_NAME, RuntimeNumeric<Unit>>(FACET_NAME, {}),

  with: <const U extends Unit> (unit: U) => {
    let cached = cache.get(unit) as Facet<typeof FACET_NAME, RuntimeNumeric<U>> | undefined

    if (cached == null) {
      cached = makeFacet<typeof FACET_NAME, RuntimeNumeric<U>>(FACET_NAME, { unit }, {
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
