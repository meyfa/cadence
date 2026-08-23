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

/**
 * Combine two types A and B into a single type C such that C is assignable to both A and B,
 * or undefined if no such type exists.
 *
 * For example, merging a "string" type and a "record" type would result in the type "string + record",
 * which is assignable to both "string" and "record".
 *
 * One demonstrative use case for this is type narrowing, where we gain additional information about a value's type
 * and want to combine that information with the value's existing type to produce a more specific type.
 */
export function mergeTypes (a: Type, b: Type): Type | undefined {
  return combineAtoms(a, b, (atomA, atomB) => atomA.merge(atomB))
}

/**
 * Combine two types A and B into a single type C such that C is assignable from both A and B,
 * or undefined if no such type exists.
 *
 * For example, intersecting "string" and "string + record" would result in "string",
 * which is assignable from both "string" and "string + record".
 * Intersecting "string" and "record" would result in undefined, since there is no common subtype.
 *
 * The typical use case for this is type inference across multiple conditional branches, where we want to find the
 * most specific type that could result from any of the branches.
 */
export function intersectTypes (a: Type, b: Type): Type | undefined {
  return combineAtoms(a, b, (atomA, atomB) => atomA.intersect(atomB))
}

type CombineAtoms = (atom: FacetType, otherAtom: FacetType) => FacetType | undefined

function combineAtoms (typeA: Type, typeB: Type, operation: CombineAtoms): Type | undefined {
  const atomsA = getPossibleTypeAtoms(typeA)
  const atomsB = getPossibleTypeAtoms(typeB)

  const results: FacetType[] = []

  for (const atomA of atomsA) {
    for (const atomB of atomsB) {
      const result = operation(atomA, atomB)
      if (result != null) {
        results.push(result)
      }
    }
  }

  return results.length === 0 ? undefined : computeTypeUnion(results)
}
