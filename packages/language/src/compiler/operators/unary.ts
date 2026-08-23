import type { ast } from '@meyfa/cadence-ast'
import type { Numeric, Unit } from '@meyfa/cadence-utility'
import { BooleanFacet } from '../../type-system/base/boolean.ts'
import { NumberFacet } from '../../type-system/base/number.ts'
import { Numbers } from '../../type-system/helpers.ts'
import type { Type, Value } from '../../type-system/types.ts'
import { liftOverFacetType } from './lifting.ts'

export interface UnaryOperation {
  readonly operator: ast.UnaryOperator

  /**
   * Returns the result type of the operation if the operand type is valid, undefined otherwise.
   */
  readonly check: (operand: Type) => Type | undefined

  /**
   * Returns the result value of the operation. The operand must have been checked beforehand.
   */
  readonly compute: (operand: Value) => Value
}

export const unaryOperations: Readonly<Record<ast.UnaryOperator, UnaryOperation>> = {
  '+': {
    operator: '+',
    check: (operand) => checkNumericOperand(operand),
    compute: (operand) => {
      // Remove facets other than NumberFacet from the operand.
      const numeric = NumberFacet.get(operand)
      return Numbers.of(numeric)
    }
  },

  '-': {
    operator: '-',
    check: (operand) => checkNumericOperand(operand),
    compute: (operand) => {
      const { unit, value } = NumberFacet.get(operand)
      return Numbers.of({ unit, value: -(value as number) as Numeric<Unit> })
    }
  },

  not: {
    operator: 'not',
    check: (operand) => BooleanFacet.is(operand) ? BooleanFacet.type() : undefined,
    compute: (operand) => {
      const value = BooleanFacet.get(operand)
      return BooleanFacet.type().of(!value)
    }
  }
}

function checkNumericOperand (operand: Type): Type | undefined {
  return liftOverFacetType(operand, (facetType) => {
    if (NumberFacet.is(facetType)) {
      const unit = NumberFacet.detail(facetType)
      return NumberFacet.with(unit).type()
    }

    return undefined
  })
}
