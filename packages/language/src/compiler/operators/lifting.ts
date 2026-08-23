import { makeUnion } from '../../type-system/factory.ts'
import { isFacetType } from '../../type-system/guards.ts'
import type { FacetType, Type } from '../../type-system/types.ts'

type CheckUnary = (type: FacetType) => Type | undefined
type CheckBinary = (left: FacetType, right: FacetType) => Type | undefined

export function getTypeAtoms (type: Type): readonly FacetType[] {
  if (isFacetType(type)) {
    return [type]
  }

  return type.members
}

export function liftOverFacetType (operand: Type, check: CheckUnary): Type | undefined {
  const results: Type[] = []

  for (const member of getTypeAtoms(operand)) {
    const result = check(member)

    // If the operation is invalid for any member, it is invalid for the entire union.
    if (result == null) {
      return undefined
    }

    results.push(result)
  }

  return combineTypes(results)
}

function combineTypes (types: readonly Type[]): Type {
  const flattened = types.flatMap((type) => getTypeAtoms(type))

  if (flattened.length === 1) {
    return flattened[0]
  }

  return makeUnion(...flattened)
}

export function liftOverFacetTypes (left: Type, right: Type, check: CheckBinary): Type | undefined {
  return liftOverFacetType(left, (leftFacet) => {
    return liftOverFacetType(right, (rightFacet) => {
      return check(leftFacet, rightFacet)
    })
  })
}
