import type { Parameter } from '@core'
import type { Unit } from '@utility'
import { makeFacet } from '../factory.js'
import type { FacetType } from '../types.js'

const FACET_NAME = 'parameter'

export const ParameterFacet = {
  ...makeFacet<typeof FACET_NAME, Parameter<Unit>>(FACET_NAME, {}),

  with: <const U extends Unit> (unit: U) => {
    return makeFacet<typeof FACET_NAME, Parameter<U>>(FACET_NAME, { unit }, {
      format: () => unit == null ? FACET_NAME : `${FACET_NAME}(${unit})`
    })
  },

  detail: (type: FacetType): Unit => {
    const { generics } = type.getFacet(FACET_NAME)
    if (!('unit' in generics)) {
      throw new Error(`Invalid generics for ${FACET_NAME} facet`)
    }

    return generics.unit as Unit
  }
}
