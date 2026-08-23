import { isGenericCustomComparable, isGenericType, isUnionType } from './guards.ts'
import type { Facet, GenericValue, Type } from './types.ts'

export function isGenericValueAssignableFrom (target: GenericValue, other: GenericValue): boolean {
  if (target === other) {
    return true
  }

  if (isGenericType(target) && isGenericType(other)) {
    return isTypeAssignableFromType(target, other)
  }

  if (isGenericCustomComparable(target)) {
    return target.checkAssignableFrom(other)
  }

  return false
}

export function isFacetAssignableFromFacet (target: Facet, other: Facet): boolean {
  if (other === target) {
    return true
  }

  return other.name === target.name && Object.keys(target.generics).every((key) => {
    if (!Object.hasOwn(other.generics, key)) {
      return false
    }

    return isGenericValueAssignableFrom(target.generics[key], other.generics[key])
  })
}

export function isFacetAssignableFromType (target: Facet, type: Type): boolean {
  if (isUnionType(type)) {
    return type.members.every((member) => isFacetAssignableFromType(target, member))
  }

  for (const typeFacet of type.facets.values()) {
    if (isFacetAssignableFromFacet(target, typeFacet)) {
      return true
    }
  }

  return false
}

export function isTypeAssignableFromType (target: Type, other: Type): boolean {
  if (other === target) {
    return true
  }

  if (isUnionType(other)) {
    return other.members.every((otherMember) => isTypeAssignableFromType(target, otherMember))
  }

  if (isUnionType(target)) {
    return target.members.some((targetMember) => isTypeAssignableFromType(targetMember, other))
  }

  for (const targetFacet of target.facets.values()) {
    const otherFacet = other.facets.get(targetFacet.name)
    if (otherFacet == null || !isFacetAssignableFromFacet(targetFacet, otherFacet)) {
      return false
    }
  }

  return true
}
