import { BooleanFacet } from '../../type-system/base/boolean.ts'
import { NumberFacet } from '../../type-system/base/number.ts'
import { StringFacet } from '../../type-system/base/string.ts'
import type { FacetType, Value } from '../../type-system/types.ts'
import { fail } from '../assert.ts'

/**
 * Returns a boolean indicating whether the two types can be compared for equality.
 */
export function areTypesEqualityComparable (left: FacetType, right: FacetType): boolean {
  if (NumberFacet.is(left) && NumberFacet.is(right)) {
    const leftUnit = NumberFacet.detail(left)
    const rightUnit = NumberFacet.detail(right)
    if (leftUnit === rightUnit) {
      return true
    }
  }

  for (const facet of [BooleanFacet, StringFacet]) {
    if (facet.is(left) && facet.is(right)) {
      return true
    }
  }

  return false
}

/**
 * Returns a boolean indicating whether the two values are equal (true) or not equal (false).
 * This assumes that the two values are of equality-comparable types.
 */
export function areValuesEqual (left: Value, right: Value): boolean {
  if (NumberFacet.has(left) && NumberFacet.has(right)) {
    const leftData = NumberFacet.get(left)
    const rightData = NumberFacet.get(right)
    return leftData.unit === rightData.unit && leftData.value === rightData.value
  }

  for (const facet of [BooleanFacet, StringFacet]) {
    if (facet.has(left) && facet.has(right)) {
      const leftData = facet.get(left)
      const rightData = facet.get(right)
      return leftData === rightData
    }
  }

  fail()
}

/**
 * Returns a boolean indicating whether the two types can be compared for relational ordering
 * (i.e., less than, greater than, less than or equal to, greater than or equal to).
 */
export function areTypesRelationallyComparable (left: FacetType, right: FacetType): boolean {
  if (NumberFacet.is(left) && NumberFacet.is(right)) {
    const leftUnit = NumberFacet.detail(left)
    const rightUnit = NumberFacet.detail(right)
    if (leftUnit === rightUnit) {
      return true
    }
  }

  return false
}

/**
 * Returns a number indicating the comparison result of two values. The return value is:
 * - negative if left is less than right
 * - zero if left is equal to right
 * - positive if left is greater than right
 *
 * This assumes that the two values are of relationally-comparable types.
 */
export function compareValues (left: Value, right: Value): number {
  if (NumberFacet.has(left) && NumberFacet.has(right)) {
    const leftData = NumberFacet.get(left)
    const rightData = NumberFacet.get(right)

    if (leftData.unit === rightData.unit) {
      // special cases for NaN and Infinity
      if (leftData.value === rightData.value) {
        return 0
      }

      return leftData.value - rightData.value
    }
  }

  fail()
}
