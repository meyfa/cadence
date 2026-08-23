import type { FacetType, Type } from '../../type-system/types.ts'
import { computeTypeUnion, getPossibleTypeAtoms } from '../../type-system/transforms.ts'

type CheckUnary = (type: FacetType) => Type | undefined
type CheckBinary = (left: FacetType, right: FacetType) => Type | undefined

export function liftOverFacetType (operand: Type, check: CheckUnary): Type | undefined {
  const results: Type[] = []

  for (const member of getPossibleTypeAtoms(operand)) {
    const result = check(member)

    // If the operation is invalid for any member, it is invalid for the entire union.
    if (result == null) {
      return undefined
    }

    results.push(result)
  }

  return computeTypeUnion(results)
}

export function liftOverFacetTypes (left: Type, right: Type, check: CheckBinary): Type | undefined {
  return liftOverFacetType(left, (leftFacet) => {
    return liftOverFacetType(right, (rightFacet) => {
      return check(leftFacet, rightFacet)
    })
  })
}
