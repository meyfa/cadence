import { ast } from '@meyfa/cadence-ast'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { unaryOperations } from '../../../src/compiler/operators/unary.ts'
import { BooleanFacet } from '../../../src/type-system/base/boolean.ts'
import { NumberFacet } from '../../../src/type-system/base/number.ts'
import { StringFacet } from '../../../src/type-system/base/string.ts'
import { Numbers } from '../../../src/type-system/helpers.ts'
import { makeUnion } from '../../../src/type-system/factory.ts'

function createNumericTestCases (operator: ast.UnaryOperator): void {
  it('should accept numeric FacetType', () => {
    const operands = [
      NumberFacet.with(undefined).type(),
      NumberFacet.with('hz').type()
    ]

    for (const operand of operands) {
      const result = unaryOperations[operator].check(operand)
      assert.strictEqual(result?.kind, 'FacetType')
      assert.deepStrictEqual(result.facets, operand.facets)
      assert.strictEqual(NumberFacet.detail(result), NumberFacet.detail(operand))
    }
  })

  it('should reject non-numeric FacetType', () => {
    const operands = [
      StringFacet.type(),
      BooleanFacet.type()
    ]

    for (const operand of operands) {
      const result = unaryOperations[operator].check(operand)
      assert.strictEqual(result, undefined)
    }
  })

  it('should accept UnionType exactly if all members are numeric FacetType', () => {
    const validOperand = makeUnion(
      NumberFacet.with(undefined).type(),
      NumberFacet.with('hz').type(),
      NumberFacet.with('db').type()
    )

    const result = unaryOperations[operator].check(validOperand)
    assert.strictEqual(result?.kind, 'UnionType')
    assert.deepStrictEqual(result.members, validOperand.members)

    const invalidOperand = makeUnion(
      NumberFacet.with(undefined).type(),
      NumberFacet.with('hz').type(),
      StringFacet.type()
    )

    assert.strictEqual(unaryOperations[operator].check(invalidOperand), undefined)
  })
}

describe('compiler/operators/unary.ts', () => {
  it('should be defined for all operators', () => {
    for (const operator of ast.unaryOperators) {
      assert.ok(unaryOperations[operator])
    }
  })

  describe('operator "+"', () => {
    createNumericTestCases('+')

    it('should return an equal value', () => {
      const operand = Numbers.of(runtimeNumeric('hz', 440))
      const result = unaryOperations['+'].compute(operand)
      assert.strictEqual(NumberFacet.detail(result.type), 'hz')
      assert.strictEqual(NumberFacet.get(result).value, 440)
    })
  })

  describe('operator "-"', () => {
    createNumericTestCases('-')

    it('should return the negated value', () => {
      const operand = Numbers.of(runtimeNumeric('hz', 440))
      const result = unaryOperations['-'].compute(operand)
      assert.strictEqual(NumberFacet.detail(result.type), 'hz')
      assert.strictEqual(NumberFacet.get(result).value, -440)
    })
  })

  describe('operator "not"', () => {
    it('should accept boolean FacetType', () => {
      const result = unaryOperations.not.check(BooleanFacet.type())
      assert.strictEqual(result, BooleanFacet.type())
    })

    it('should reject non-boolean FacetType', () => {
      const operands = [
        StringFacet.type(),
        NumberFacet.with(undefined).type()
      ]

      for (const operand of operands) {
        const result = unaryOperations.not.check(operand)
        assert.strictEqual(result, undefined)
      }
    })

    it('should accept UnionType exactly if all members are boolean FacetType', () => {
      const validOperand = makeUnion(
        BooleanFacet.type(),
        BooleanFacet.type()
      )

      const result = unaryOperations.not.check(validOperand)
      assert.strictEqual(result?.kind, 'FacetType')
      assert.deepStrictEqual([...result.facets.keys()], [BooleanFacet.name])

      const invalidOperand = makeUnion(
        BooleanFacet.type(),
        StringFacet.type()
      )

      assert.strictEqual(unaryOperations.not.check(invalidOperand), undefined)
    })

    it('should return the negated value', () => {
      const operand = BooleanFacet.type().of(true)
      const result = unaryOperations.not.compute(operand)
      assert.strictEqual(BooleanFacet.get(result), false)
    })
  })
})
