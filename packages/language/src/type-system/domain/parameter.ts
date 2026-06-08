import type { Parameter } from '@core'
import type { Unit } from '@utility'
import { makeFacet } from '../factory.js'
import type { Facet, FacetType } from '../types.js'

const FACET_NAME = 'parameter'

const cache = new Map<Unit, Facet<typeof FACET_NAME, Parameter<Unit>>>()

export const ParameterFacet = {
  ...makeFacet<typeof FACET_NAME, Parameter<Unit>>(FACET_NAME, {}),

  with: <const U extends Unit> (unit: U) => {
    let cached = cache.get(unit) as Facet<typeof FACET_NAME, Parameter<U>> | undefined

    if (cached == null) {
      cached = makeFacet<typeof FACET_NAME, Parameter<U>>(FACET_NAME, { unit }, {
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
