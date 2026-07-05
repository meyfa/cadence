import type { Numeric, Unit } from '@utility'
import { makeFacet } from '../factory.js'
import type { Facet, FacetType } from '../types.js'

export type CurveDuration = Numeric<'beats'> | Numeric<'s'>

export interface Curve<U extends Unit> {
  readonly unit: U
  readonly segments: ReadonlyArray<CurveSegment<U>>
}

export type CurveSegment<U extends Unit> = HoldCurveSegment<U> | LinearCurveSegment<U>

export interface HoldCurveSegment<U extends Unit> {
  readonly type: 'hold'
  readonly length: CurveDuration
  readonly unit: U
  readonly value: Numeric<U>
}

export interface LinearCurveSegment<U extends Unit> {
  readonly type: 'lin'
  readonly length: CurveDuration
  readonly unit: U
  readonly start: Numeric<U>
  readonly end: Numeric<U>
}

const FACET_NAME = 'curve'

const cache = new Map<Unit, Facet<typeof FACET_NAME, Curve<Unit>>>()

export const CurveFacet = {
  ...makeFacet<typeof FACET_NAME, Curve<Unit>>(FACET_NAME, {}),

  with: <const U extends Unit> (unit: U) => {
    let cached = cache.get(unit) as Facet<typeof FACET_NAME, Curve<U>> | undefined

    if (cached == null) {
      cached = makeFacet<typeof FACET_NAME, Curve<U>>(FACET_NAME, { unit }, {
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
