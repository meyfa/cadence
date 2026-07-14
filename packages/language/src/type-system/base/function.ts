import { makeFacet } from '../factory.ts'
import type { InferSchema, Schema } from '../schema.ts'
import type { CustomComparable, FacetType, ValueForType } from '../types.ts'

export interface Effects {
  readonly blocking: boolean
}

export interface Function<S extends Schema = Schema, R extends FacetType = FacetType, Context = never> {
  readonly parameters: S
  readonly returnType: R
  readonly effects: Effects
  readonly invoke: (context: Context, args: InferSchema<S>) => ValueForType<R>

  // documentation
  readonly summary?: string
}

interface FunctionSpec<S extends Schema = Schema, R extends FacetType = FacetType> {
  readonly parameters: S
  readonly returnType: R
  readonly effects: Effects
}

interface FunctionSpecGeneric extends CustomComparable {
  readonly value: FunctionSpec
}

const FACET_NAME = 'function'

export const FunctionFacet = {
  ...makeFacet<typeof FACET_NAME, Function>(FACET_NAME, {}),

  with: <const S extends Schema, const R extends FacetType> (spec: FunctionSpec<S, R>) => {
    const generic: FunctionSpecGeneric = {
      value: spec,

      // identity check for now; if we ever want to support structural compatibility for functions,
      // the schema and return type would have to be checked for assignability
      checkAssignableFrom: (other: unknown): boolean => {
        if (typeof other !== 'object' || other == null || !('value' in other)) {
          return false
        }

        const otherSpec = (other as FunctionSpecGeneric).value
        return spec === otherSpec
      }
    }

    return makeFacet<typeof FACET_NAME, Function<S, R>>(FACET_NAME, { spec: generic })
  },

  detail: (type: FacetType): FunctionSpec => {
    const { generics } = type.getFacet(FACET_NAME)
    if (!('spec' in generics)) {
      throw new Error(`Invalid generics for ${FACET_NAME} facet`)
    }

    return (generics.spec as FunctionSpecGeneric).value
  }
}
