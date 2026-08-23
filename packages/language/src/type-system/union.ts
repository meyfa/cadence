import { makeUnionType } from './factory.ts'
import { isFacetType, isUnionType } from './guards.ts'
import type { FacetType, Type } from './types.ts'

/**
 * Returns an array of all atomic types (i.e., non-union types) that the given type can represent.
 * In other words, this splits a disjunction of types into the constituent types, of which exactly one
 * will be the actual type of a value at runtime.
 */
export function getPossibleTypeAtoms (type: Type): readonly FacetType[] {
  if (isFacetType(type)) {
    return [type]
  }

  return type.members
}

/**
 * Computes the union of a set of types, returning a single type that represents all possible values of the input types.
 * The result is a de-duplicated disjunction of types.
 */
export function computeTypeUnion (members: readonly Type[]): Type {
  if (members.length === 0) {
    throw new Error('Cannot compute union of an empty set of types')
  }

  const flattened: FacetType[] = []

  for (const member of members) {
    if (isUnionType(member)) {
      for (const nestedMember of member.members) {
        appendUniqueType(flattened, nestedMember)
      }
    } else {
      appendUniqueType(flattened, member)
    }
  }

  if (flattened.length === 1) {
    return flattened[0]
  }

  return makeUnionType(...flattened)
}

function appendUniqueType (types: Type[], type: Type): void {
  // De-duplicate types that are bidirectionally assignable to each other, i.e. equivalent.
  if (!types.some((existing) => existing.is(type) && type.is(existing))) {
    types.push(type)
  }
}
