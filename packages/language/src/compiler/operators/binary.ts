import type { ast } from '@meyfa/cadence-ast'
import { concatPatterns, multiplyPattern } from '@meyfa/cadence-core'
import type { Numeric, Unit } from '@meyfa/cadence-utility'
import { NumberFacet } from '../../type-system/base/number.ts'
import { StringFacet } from '../../type-system/base/string.ts'
import { PatternFacet } from '../../type-system/domain/pattern.ts'
import { Numbers } from '../../type-system/helpers.ts'
import type { FacetType, Value } from '../../type-system/types.ts'
import { fail } from '../assert.ts'

export interface BinaryOperation {
  readonly operator: ast.BinaryOperator
  readonly check: (left: FacetType, right: FacetType) => FacetType | undefined
  readonly compute: (left: Value, right: Value) => Value
}

const add: BinaryOperation = {
  operator: '+',

  check: (left, right) => {
    if (StringFacet.is(left) && StringFacet.is(right)) {
      return left
    }

    if (PatternFacet.is(left) && PatternFacet.is(right)) {
      return left
    }

    if (NumberFacet.is(left) && NumberFacet.is(right)) {
      const leftUnit = NumberFacet.detail(left)
      const rightUnit = NumberFacet.detail(right)
      if (leftUnit === rightUnit) {
        return left
      }
    }

    return undefined
  },

  compute: (left, right) => {
    if (StringFacet.has(left) && StringFacet.has(right)) {
      const leftData = StringFacet.get(left)
      const rightData = StringFacet.get(right)
      return StringFacet.type().of(leftData + rightData)
    }

    if (PatternFacet.has(left) && PatternFacet.has(right)) {
      const leftData = PatternFacet.get(left)
      const rightData = PatternFacet.get(right)
      return PatternFacet.type().of(concatPatterns([leftData, rightData]))
    }

    if (NumberFacet.has(left) && NumberFacet.has(right)) {
      const leftData = NumberFacet.get(left)
      const rightData = NumberFacet.get(right)
      return Numbers.of({
        unit: leftData.unit,
        value: (leftData.value + rightData.value) as Numeric<Unit>
      })
    }

    fail()
  }
}

const subtract: BinaryOperation = {
  operator: '-',

  check: (left, right) => {
    if (NumberFacet.is(left) && NumberFacet.is(right)) {
      const leftUnit = NumberFacet.detail(left)
      const rightUnit = NumberFacet.detail(right)
      if (leftUnit === rightUnit) {
        return left
      }
    }

    return undefined
  },

  compute: (left, right) => {
    if (NumberFacet.has(left) && NumberFacet.has(right)) {
      const leftData = NumberFacet.get(left)
      const rightData = NumberFacet.get(right)
      return Numbers.of({
        unit: leftData.unit,
        value: (leftData.value - rightData.value) as Numeric<Unit>
      })
    }

    fail()
  }
}

const multiply: BinaryOperation = {
  operator: '*',

  check: (left, right) => {
    if (NumberFacet.is(left) && NumberFacet.is(right)) {
      const leftUnit = NumberFacet.detail(left)
      const rightUnit = NumberFacet.detail(right)
      if (leftUnit == null || rightUnit == null) {
        return NumberFacet.with(leftUnit ?? rightUnit).type()
      }
    }

    if (
      (PatternFacet.is(left) && NumberFacet.with(undefined).is(right)) ||
      (NumberFacet.with(undefined).is(left) && PatternFacet.is(right))
    ) {
      return PatternFacet.type()
    }

    return undefined
  },

  compute: (left, right) => {
    if (NumberFacet.has(left) && NumberFacet.has(right)) {
      const leftData = NumberFacet.get(left)
      const rightData = NumberFacet.get(right)
      return Numbers.of({
        unit: leftData.unit ?? rightData.unit,
        value: (leftData.value * rightData.value) as Numeric<Unit>
      })
    }

    if (PatternFacet.has(left) && NumberFacet.has(right)) {
      const leftData = PatternFacet.get(left)
      const rightData = NumberFacet.get(right)
      return PatternFacet.type().of(multiplyPattern(leftData, rightData.value))
    }

    if (NumberFacet.has(left) && PatternFacet.has(right)) {
      const leftData = NumberFacet.get(left)
      const rightData = PatternFacet.get(right)
      return PatternFacet.type().of(multiplyPattern(rightData, leftData.value))
    }

    fail()
  }
}

const divide: BinaryOperation = {
  operator: '/',

  check: (left, right) => {
    if (NumberFacet.is(left) && NumberFacet.is(right)) {
      const leftUnit = NumberFacet.detail(left)
      const rightUnit = NumberFacet.detail(right)

      // equal units cancel out
      if (leftUnit === rightUnit) {
        return NumberFacet.with(undefined).type()
      }

      if (rightUnit == null) {
        return left
      }
    }

    if (PatternFacet.is(left) && NumberFacet.with(undefined).is(right)) {
      return left
    }

    return undefined
  },

  compute: (left, right) => {
    if (NumberFacet.has(left) && NumberFacet.has(right)) {
      const leftData = NumberFacet.get(left)
      const rightData = NumberFacet.get(right)
      // Equal units cancel out
      const unit = leftData.unit === rightData.unit ? undefined : leftData.unit
      return Numbers.of({
        unit,
        value: (leftData.value / rightData.value) as Numeric<Unit>
      })
    }

    if (PatternFacet.has(left) && NumberFacet.has(right)) {
      const leftData = PatternFacet.get(left)
      const rightData = NumberFacet.get(right)
      return PatternFacet.type().of(multiplyPattern(leftData, 1.0 / rightData.value))
    }

    fail()
  }
}

export const binaryOperations: Readonly<Record<ast.BinaryOperator, BinaryOperation>> = {
  '+': add,
  '-': subtract,
  '*': multiply,
  '/': divide
}
