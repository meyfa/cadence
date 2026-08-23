import { isFacetAssignableFromFacet, isFacetAssignableFromType, isTypeAssignableFromType } from './assignability.ts'
import { isFacet } from './guards.ts'
import type { DataForFacets, Facet, FacetType, Generics, SpecificFacetDataForValue, Type, UnionType, Value, ValueForType } from './types.ts'

export interface FacetOptions<Data = unknown> {
  readonly format?: () => string
  readonly normalize?: (data: unknown) => Data
  readonly merge?: (other: Facet) => Facet | undefined
  readonly intersect?: (other: Facet) => Facet | undefined
}

export function makeFacet<const Name extends string, Data> (
  name: Name,
  generics: Generics,
  options?: FacetOptions<Data>
): Facet<Name, Data> {
  let cachedType: FacetType<[Facet<Name, Data>]> | undefined = undefined

  const facet: Facet<Name, Data> = {
    kind: 'Facet',

    name,
    generics,

    format: options?.format ?? (() => name),

    is: (other: Facet | Type): boolean => {
      if (isFacet(other)) {
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
        throw new Error(`Value is not assignable to facet: ${facet.format()}`)
      }

      return value.data.get(facet.name) as SpecificFacetDataForValue<V, Name, Data>
    },

    merge: options?.merge ?? ((other: Facet) => mergeFacets(facet, other)),
    intersect: options?.intersect ?? ((other: Facet) => intersectFacets(facet, other)),

    type: () => {
      cachedType ??= makeFacetType(facet)
      return cachedType
    },

    normalize: options?.normalize
  }

  return facet
}

function mergeFacets (facet: Facet, other: Facet): Facet | undefined {
  if (facet.name !== other.name) {
    return undefined
  }

  if (isFacetAssignableFromFacet(facet, other) && isFacetAssignableFromFacet(other, facet)) {
    return facet
  }

  return undefined
}

function intersectFacets (facet: Facet, other: Facet): Facet | undefined {
  if (facet.name !== other.name) {
    return undefined
  }

  if (isFacetAssignableFromFacet(facet, other)) {
    return facet
  }

  if (isFacetAssignableFromFacet(other, facet)) {
    return other
  }

  return undefined
}

export function makeFacetType<const Facets extends readonly Facet[]> (
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
    kind: 'FacetType',

    facets: facetMap,

    format: () => {
      const joined = facets.map((facet) => facet.format()).join(' + ')
      return facets.length > 1 ? `(${joined})` : joined
    },

    is: (other: Type): boolean => {
      return isTypeAssignableFromType(type, other)
    },

    has: (value: Value): value is ValueForType<FacetType<Facets>> => {
      return isTypeAssignableFromType(type, value.type)
    },

    of: (...data: DataForFacets<Facets>): ValueForType<FacetType<Facets>> => {
      const dataMap = new Map<string, unknown>(
        Array.from(type.facets.entries(), ([name, facet], index) => [
          name,
          facet.normalize == null ? data[index] : facet.normalize(data[index])
        ])
      )

      return { type, data: dataMap }
    },

    merge: (other: FacetType): FacetType | undefined => mergeFacetTypes(type, other),
    intersect: (other: FacetType): FacetType | undefined => intersectFacetTypes(type, other),

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

function mergeFacetTypes (type: FacetType, other: FacetType): FacetType | undefined {
  if (other === type) {
    return type
  }

  const resultFacets: Facet[] = []

  for (const name of new Set([...type.facets.keys(), ...other.facets.keys()])) {
    const a = type.facets.get(name)
    const b = other.facets.get(name)

    if (a != null && b != null) {
      const merged = a.merge(b)
      if (merged == null) {
        return undefined
      }
      resultFacets.push(merged)
    } else if (a != null) {
      resultFacets.push(a)
    } else if (b != null) {
      resultFacets.push(b)
    }
  }

  return makeFacetType(...resultFacets)
}

function intersectFacetTypes (type: FacetType, other: FacetType): FacetType | undefined {
  if (other === type) {
    return type
  }

  const resultFacets: Facet[] = []

  for (const [name, a] of type.facets) {
    const b = other.facets.get(name)
    if (b == null) {
      continue
    }

    const intersected = a.intersect(b)
    if (intersected == null) {
      continue
    }

    resultFacets.push(intersected)
  }

  if (resultFacets.length === 0) {
    return undefined
  }

  return makeFacetType(...resultFacets)
}

export function makeUnionType<const Members extends readonly FacetType[]> (
  ...members: Members
): UnionType<Members> {
  if (members.length === 0) {
    throw new Error('Expected at least one member')
  }

  const type = {
    kind: 'UnionType',

    members,

    format: () => {
      const joined = members.map((member) => member.format()).join(' | ')
      return members.length > 1 ? `(${joined})` : joined
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
