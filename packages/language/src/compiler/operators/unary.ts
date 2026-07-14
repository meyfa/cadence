import type { ast } from '@meyfa/cadence-ast'
import type { Numeric, Unit } from '@meyfa/cadence-utility'
import { NumberFacet } from '../../type-system/base/number.js'
import { Numbers } from '../../type-system/helpers.js'
import type { FacetType, Value } from '../../type-system/types.js'

export interface UnaryOperation {
  readonly operator: ast.UnaryOperator
  readonly check: (operand: FacetType) => FacetType | undefined
  readonly compute: (operand: Value) => Value
}

export const unaryOperations: Readonly<Record<ast.UnaryOperator, UnaryOperation>> = {
  '+': {
    operator: '+',
    check: (operand) => NumberFacet.is(operand) ? operand : undefined,
    compute: (operand) => operand
  },

  '-': {
    operator: '-',
    check: (operand) => NumberFacet.is(operand) ? operand : undefined,
    compute: (operand) => {
      const { unit, value } = NumberFacet.get(operand)
      return Numbers.of({ unit, value: -(value as number) as Numeric<Unit> })
    }
  }
}
