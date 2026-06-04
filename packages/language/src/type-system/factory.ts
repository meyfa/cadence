import { isFacetAssignableFromFacet, isFacetAssignableFromType, isTypeAssignableFromType } from './assignability.js'
import type { DataForFacets, Facet, FacetType, Generics, SpecificFacetDataForValue, Type, UnionType, Value, ValueForType } from './types.js'

export interface FacetOptions {
  readonly format?: () => string
}

export function makeFacet<const Name extends string, Data> (
  name: Name,
  generics: Generics,
  options?: FacetOptions
): Facet<Name, Data> {
  let cachedType: FacetType<[Facet<Name, Data>]> | undefined = undefined

  const facet: Facet<Name, Data> = {
    name,
    generics,

    format: options?.format ?? (() => name),

    is: (other: Facet | Type): boolean => {
      if ('name' in other && 'generics' in other) {
        return isFacetAssignableFromFacet(facet, other)
      } else {
        return isFacetAssignableFromType(facet, other)
      }
    },

    has: (value: Value): value is Value<Facet<Name, Data>> => {
      return isFacetAssignableFromType(facet, value.type)
    },

    get: <const V extends Value>(value: V): SpecificFacetDataForValue<V, Name, Data> => {
      if (!isFacetAssignableFromType(facet, value.type)) {
        throw new Error(`Value is not assignable to facet ${facet.name}`)
      }

      return value.data.get(facet.name) as SpecificFacetDataForValue<V, Name, Data>
    },

    type: () => {
      cachedType ??= makeType(facet)
      return cachedType
    }
  }

  return facet
}

export function makeType<const Facets extends readonly Facet[]> (
  ...facets: Facets
): FacetType<Facets> {
  if (facets.length === 0) {
    throw new Error('Expected at least one facet')
  }

  const facetMap = new Map<string, Facet>(
    facets.map((facet) => [facet.name, facet])
  )
  if (facetMap.size !== facets.length) {
    throw new Error('Duplicate facet names are not allowed in a type')
  }

  const type = {
    facets: facetMap,

    format: () => {
      return facets.map((facet) => facet.format()).join(' + ')
    },

    is: (other: Type): boolean => {
      return isTypeAssignableFromType(type, other)
    },

    has: (value: Value): value is ValueForType<FacetType<Facets>> => {
      return isTypeAssignableFromType(type, value.type)
    },

    of: (...data: DataForFacets<Facets>): ValueForType<FacetType<Facets>> => {
      const dataMap = new Map<string, unknown>(
        Array.from(type.facets.entries(), ([name], index) => [name, data[index]])
      )

      return { type, data: dataMap }
    },

    getFacet: (name: string): Facets[number] => {
      const facet = type.facets.get(name)
      if (facet == null) {
        throw new Error(`Facet ${name} not found in type`)
      }
      return facet
    }
  } satisfies FacetType<Facets>

  return type
}

export function makeUnion<const Members extends readonly FacetType[]> (
  ...members: Members
): UnionType<Members> {
  if (members.length === 0) {
    throw new Error('Expected at least one member')
  }

  const type = {
    members,

    format: () => {
      return members.map((member) => member.format()).join(' | ')
    },

    is: (other: Type): boolean => {
      return isTypeAssignableFromType(type, other)
    },

    has: (value: Value): value is ValueForType<UnionType<Members>> => {
      return isTypeAssignableFromType(type, value.type)
    }
  } satisfies UnionType<Members>

  return type
}
