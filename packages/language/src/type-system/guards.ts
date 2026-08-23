import type { Type, UnionType, FacetType, GenericValue, CustomComparable, Facet } from './types.ts'

const FacetTypeKind: FacetType['kind'] = 'FacetType'
const FacetKind: Facet['kind'] = 'Facet'
const UnionTypeKind: UnionType['kind'] = 'UnionType'

export const isFacet = (object: Type | Facet): object is Facet => {
  return object.kind === FacetKind
}

export const isType = (object: Type | Facet): object is Type => {
  return object.kind !== FacetKind
}

export const isFacetType = (type: Type): type is FacetType => {
  return type.kind === FacetTypeKind
}

export const isUnionType = (type: Type): type is UnionType => {
  return type.kind === UnionTypeKind
}

export const isGenericType = (value: GenericValue): value is Type => {
  return typeof value === 'object' && 'kind' in value && (isUnionType(value) || isFacetType(value))
}

export const isGenericCustomComparable = (value: GenericValue): value is CustomComparable => {
  return typeof value === 'object' && 'checkAssignableFrom' in value
}
