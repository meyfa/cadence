import type { Numeric, Unit } from '@utility'
import { makeFacet } from '../factory.js'
import type { FacetType } from '../types.js'

const FACET_NAME = 'number'

export const NumberFacet = {
  ...makeFacet<typeof FACET_NAME, Numeric<Unit>>(FACET_NAME, {}),

  with: <const U extends Unit> (unit: U) => {
    return makeFacet<typeof FACET_NAME, Numeric<U>>(FACET_NAME, { unit }, {
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
