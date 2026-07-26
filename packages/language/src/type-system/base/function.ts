import { makeFacet } from '../factory.ts'
import type { InferSchema, Schema } from '../schema.ts'
import type { CustomComparable, FacetType, ValueForType } from '../types.ts'

export interface Effects {
  readonly blocking: boolean
}

export interface ParameterError {
  readonly parameter: string
  readonly message: string
}

export interface FunctionSpec<
  S extends Schema = Schema,
  R extends FacetType = FacetType
> {
  readonly parameters: S
  readonly returnType: R
  readonly effects: Effects

  /**
   * Perform additional static checks on the argument types,
   * such as validating that generics are compatible between the arguments.
   *
   * If an argument is missing from the map, do not report an error; this will already be handled by the schema validation.
   */
  readonly check?: (args: ReadonlyMap<string, FacetType>) => readonly ParameterError[]
}

export interface FunctionRuntime<
  S extends Schema = Schema,
  R extends FacetType = FacetType,
  Context = never
> {
  /**
   * Compute the return value of the function given the provided arguments.
   */
  readonly invoke: (context: Context, args: InferSchema<S>) => ValueForType<R>

  // documentation
  readonly summary?: string
}

export interface Function<
  S extends Schema = Schema,
  R extends FacetType = FacetType,
  Context = never
> extends FunctionSpec<S, R>, FunctionRuntime<S, R, Context> {
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

      checkAssignableFrom: (other: unknown): boolean => {
        if (typeof other !== 'object' || other == null || !('value' in other)) {
          return false
        }

        const otherSpec = (other as FunctionSpecGeneric).value
        return isAssignableFrom(spec, otherSpec)
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

function isAssignableFrom (spec: FunctionSpec, other: FunctionSpec): boolean {
  // Return type:
  // - other return type must be assignable to spec return type (covariant)
  if (!spec.returnType.is(other.returnType)) {
    return false
  }

  // Effects:
  // - non-blocking is assignable to blocking, but not vice versa
  if (!spec.effects.blocking && other.effects.blocking) {
    return false
  }

  // parameters:
  // - same or compatible parameter count (accounting for optional tail parameters):
  //     other can have equal or more optional parameters, not less
  //     Example: (a: string, b?: number) is assignable to (a: string), but not vice versa
  // - same parameter names
  //     Example: (a: string) is not assignable to (b: string)
  // - assignable parameter types (contravariant)
  //     Example: (a: { gain }) is assignable to (a: { gain, pan }), but not vice versa

  // Note (future improvement): We could allow different parameter names by mapping from the
  // call-site parameter names to the function value's internal parameter names in the compiler.

  if (spec.parameters.items.length > other.parameters.items.length) {
    return false
  }

  let specIndex = 0
  let otherIndex = 0

  while (specIndex < spec.parameters.items.length && otherIndex < other.parameters.items.length) {
    const specParam = spec.parameters.items[specIndex]
    const otherParam = other.parameters.items[otherIndex]

    if (specParam.name !== otherParam.name) {
      return false
    }

    if (!otherParam.type.is(specParam.type)) {
      return false
    }

    if (!specParam.required && otherParam.required) {
      return false
    }

    ++specIndex
    ++otherIndex
  }

  // if other has more parameters, they must all be optional
  while (otherIndex < other.parameters.items.length) {
    const otherParam = other.parameters.items[otherIndex]
    if (otherParam.required) {
      return false
    }
    ++otherIndex
  }

  return true
}
