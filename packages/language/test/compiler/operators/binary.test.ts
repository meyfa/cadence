import { ast } from '@meyfa/cadence-ast'
import type { Numeric } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { binaryOperations } from '../../../src/compiler/operators/binary.ts'
import { BooleanFacet } from '../../../src/type-system/base/boolean.ts'
import { NumberFacet } from '../../../src/type-system/base/number.ts'
import { StringFacet } from '../../../src/type-system/base/string.ts'
import { Numbers } from '../../../src/type-system/helpers.ts'
import { PatternFacet } from '../../../src/type-system/domain/pattern.ts'
import { createSerialPattern } from '@meyfa/cadence-core'
import { RecordFacet } from '../../../src/type-system/base/record.ts'
import { FunctionFacet } from '../../../src/type-system/base/function.ts'

describe('compiler/operators/binary.ts', () => {
  it('should be defined for all operators', () => {
    for (const operator of ast.binaryOperators) {
      assert.ok(binaryOperations[operator])
    }
  })

  describe('operator "+"', () => {
    it('should accept StringFacet', () => {
      const resultType = binaryOperations['+'].check(StringFacet.type(), StringFacet.type())
      assert.strictEqual(resultType?.kind, 'FacetType')
      assert.deepStrictEqual([...resultType.facets.keys()], [StringFacet.name])

      const left = StringFacet.type().of('Hello, ')
      const right = StringFacet.type().of('World!')
      const resultValue = binaryOperations['+'].compute(left, right)
      assert.strictEqual(StringFacet.get(resultValue), 'Hello, World!')
    })

    it('should accept PatternFacet', () => {
      const resultType = binaryOperations['+'].check(PatternFacet.type(), PatternFacet.type())
      assert.strictEqual(resultType?.kind, 'FacetType')
      assert.deepStrictEqual([...resultType.facets.keys()], [PatternFacet.name])

      const left = PatternFacet.type().of(createSerialPattern([
        { value: 'C5', length: 1 as Numeric<'beats'> },
        { value: 'D5', length: 3 as Numeric<'beats'> }
      ]))
      const right = PatternFacet.type().of(createSerialPattern([
        { value: 'E5', length: 2 as Numeric<'beats'> },
        { value: 'F5', length: 6 as Numeric<'beats'> }
      ]))
      const resultValue = binaryOperations['+'].compute(left, right)
      assert.deepStrictEqual([...PatternFacet.get(resultValue).evaluate()], [
        { time: 0, pitch: 'C5', velocity: 1, gate: 1 },
        { time: 1, pitch: 'D5', velocity: 1, gate: 3 },
        { time: 4, pitch: 'E5', velocity: 1, gate: 2 },
        { time: 6, pitch: 'F5', velocity: 1, gate: 6 }
      ])
    })

    it('should accept NumberFacet with same unit', () => {
      for (const unit of [undefined, 'hz'] as const) {
        const leftType = NumberFacet.with(unit).type()
        const rightType = NumberFacet.with(unit).type()
        const resultType = binaryOperations['+'].check(leftType, rightType)
        assert.strictEqual(resultType?.kind, 'FacetType')
        assert.deepStrictEqual([...resultType.facets.keys()], [NumberFacet.name])
        assert.strictEqual(NumberFacet.detail(resultType), unit)

        const leftValue = Numbers.of(runtimeNumeric(unit, 440))
        const rightValue = Numbers.of(runtimeNumeric(unit, 220))
        const resultValue = binaryOperations['+'].compute(leftValue, rightValue)
        assert.strictEqual(NumberFacet.detail(resultValue.type), unit)
        assert.strictEqual(NumberFacet.get(resultValue).value, 660)
      }
    })

    it('should reject NumberFacet with different units', () => {
      const leftType = NumberFacet.with('hz').type()
      const rightType = NumberFacet.with(undefined).type()
      const resultType = binaryOperations['+'].check(leftType, rightType)
      assert.strictEqual(resultType, undefined)
    })

    it('should reject other facet types', () => {
      const leftType = BooleanFacet.type()
      const rightType = BooleanFacet.type()
      const resultType = binaryOperations['+'].check(leftType, rightType)
      assert.strictEqual(resultType, undefined)
    })
  })

  describe('operator "-"', () => {
    it('should accept NumberFacet with same unit', () => {
      for (const unit of [undefined, 'hz'] as const) {
        const leftType = NumberFacet.with(unit).type()
        const rightType = NumberFacet.with(unit).type()
        const resultType = binaryOperations['-'].check(leftType, rightType)
        assert.strictEqual(resultType?.kind, 'FacetType')
        assert.deepStrictEqual([...resultType.facets.keys()], [NumberFacet.name])
        assert.strictEqual(NumberFacet.detail(resultType), unit)

        const leftValue = Numbers.of(runtimeNumeric(unit, 660))
        const rightValue = Numbers.of(runtimeNumeric(unit, 220))
        const resultValue = binaryOperations['-'].compute(leftValue, rightValue)
        assert.strictEqual(NumberFacet.detail(resultValue.type), unit)
        assert.strictEqual(NumberFacet.get(resultValue).value, 440)
      }
    })

    it('should reject NumberFacet with different units', () => {
      const leftType = NumberFacet.with('hz').type()
      const rightType = NumberFacet.with(undefined).type()
      const resultType = binaryOperations['-'].check(leftType, rightType)
      assert.strictEqual(resultType, undefined)
    })

    it('should reject other facet types', () => {
      const leftType = BooleanFacet.type()
      const rightType = BooleanFacet.type()
      const resultType = binaryOperations['-'].check(leftType, rightType)
      assert.strictEqual(resultType, undefined)
    })
  })

  describe('operator "*"', () => {
    it('should accept NumberFacet if at least one of the operands has no unit', () => {
      const testCases = [
        [NumberFacet.with(undefined).type(), NumberFacet.with('hz').type(), 'hz'],
        [NumberFacet.with('hz').type(), NumberFacet.with(undefined).type(), 'hz'],
        [NumberFacet.with(undefined).type(), NumberFacet.with(undefined).type(), undefined]
      ] as const

      for (const [leftType, rightType, expectedUnit] of testCases) {
        const resultType = binaryOperations['*'].check(leftType, rightType)
        assert.strictEqual(resultType?.kind, 'FacetType')
        assert.deepStrictEqual([...resultType.facets.keys()], [NumberFacet.name])
        assert.strictEqual(NumberFacet.detail(resultType), expectedUnit)
      }

      const leftValue = Numbers.of(runtimeNumeric('hz', 440))
      const rightValue = Numbers.of(runtimeNumeric(undefined, 2))
      const resultValue = binaryOperations['*'].compute(leftValue, rightValue)
      assert.strictEqual(NumberFacet.detail(resultValue.type), 'hz')
      assert.strictEqual(NumberFacet.get(resultValue).value, 880)
    })

    it('should reject NumberFacet if both operands have a unit', () => {
      const leftType = NumberFacet.with('hz').type()
      const rightType = NumberFacet.with('hz').type()
      const resultType = binaryOperations['*'].check(leftType, rightType)
      assert.strictEqual(resultType, undefined)
    })

    it('should accept PatternFacet with NumberFacet', () => {
      const testCases = [
        [PatternFacet.type(), NumberFacet.with(undefined).type()],
        [NumberFacet.with(undefined).type(), PatternFacet.type()]
      ]

      for (const [leftType, rightType] of testCases) {
        const resultType = binaryOperations['*'].check(leftType, rightType)
        assert.strictEqual(resultType?.kind, 'FacetType')
        assert.deepStrictEqual([...resultType.facets.keys()], [PatternFacet.name])
      }

      const leftValue = PatternFacet.type().of(createSerialPattern([
        { value: 'C5', length: 1 as Numeric<'beats'> },
        { value: 'D5', length: 3 as Numeric<'beats'> }
      ]))
      const rightValue = Numbers.of(runtimeNumeric(undefined, 2))
      const resultValue = binaryOperations['*'].compute(leftValue, rightValue)
      assert.deepStrictEqual([...PatternFacet.get(resultValue).evaluate()], [
        { time: 0, pitch: 'C5', velocity: 1, gate: 2 },
        { time: 2, pitch: 'D5', velocity: 1, gate: 6 }
      ])
    })

    it('should reject PatternFacet with NumberFacet if the number has a unit', () => {
      const testCases = [
        [PatternFacet.type(), NumberFacet.with('hz').type()],
        [NumberFacet.with('hz').type(), PatternFacet.type()]
      ]

      for (const [leftType, rightType] of testCases) {
        const resultType = binaryOperations['*'].check(leftType, rightType)
        assert.strictEqual(resultType, undefined)
      }
    })

    it('should reject other facet types', () => {
      const testCases = [
        // with one of the supported operands
        [BooleanFacet.type(), NumberFacet.with(undefined).type()],
        [NumberFacet.with(undefined).type(), BooleanFacet.type()],
        [BooleanFacet.type(), PatternFacet.type()],
        [PatternFacet.type(), BooleanFacet.type()],
        // with two unsupported operands
        [BooleanFacet.type(), BooleanFacet.type()],
        [StringFacet.type(), StringFacet.type()]
      ]

      for (const [leftType, rightType] of testCases) {
        const resultType = binaryOperations['*'].check(leftType, rightType)
        assert.strictEqual(resultType, undefined)
      }
    })
  })

  describe('operator "/"', () => {
    it('should accept NumberFacet with equal units', () => {
      const testCases = [
        [NumberFacet.with(undefined).type(), NumberFacet.with(undefined).type()],
        [NumberFacet.with('hz').type(), NumberFacet.with('hz').type()]
      ]

      for (const [leftType, rightType] of testCases) {
        const resultType = binaryOperations['/'].check(leftType, rightType)
        assert.strictEqual(resultType?.kind, 'FacetType')
        assert.deepStrictEqual([...resultType.facets.keys()], [NumberFacet.name])
        // should cancel out the units
        assert.strictEqual(NumberFacet.detail(resultType), undefined)
      }

      const leftValue = Numbers.of(runtimeNumeric('hz', 440))
      const rightValue = Numbers.of(runtimeNumeric('hz', 220))
      const resultValue = binaryOperations['/'].compute(leftValue, rightValue)
      assert.strictEqual(NumberFacet.detail(resultValue.type), undefined)
      assert.strictEqual(NumberFacet.get(resultValue).value, 2)
    })

    it('should accept NumberFacet if the right operand has no unit', () => {
      const leftType = NumberFacet.with('hz').type()
      const rightType = NumberFacet.with(undefined).type()
      const resultType = binaryOperations['/'].check(leftType, rightType)
      assert.strictEqual(resultType?.kind, 'FacetType')
      assert.deepStrictEqual([...resultType.facets.keys()], [NumberFacet.name])
      // should keep the left unit
      assert.strictEqual(NumberFacet.detail(resultType), 'hz')

      const leftValue = Numbers.of(runtimeNumeric('hz', 440))
      const rightValue = Numbers.of(runtimeNumeric(undefined, 2))
      const resultValue = binaryOperations['/'].compute(leftValue, rightValue)
      assert.strictEqual(NumberFacet.detail(resultValue.type), 'hz')
      assert.strictEqual(NumberFacet.get(resultValue).value, 220)
    })

    it('should reject NumberFacet if the right operand has a unit', () => {
      const leftType = NumberFacet.with(undefined).type()
      const rightType = NumberFacet.with('hz').type()
      const resultType = binaryOperations['/'].check(leftType, rightType)
      assert.strictEqual(resultType, undefined)
    })

    it('should accept PatternFacet left, NumberFacet right', () => {
      const leftType = PatternFacet.type()
      const rightType = NumberFacet.with(undefined).type()
      const resultType = binaryOperations['/'].check(leftType, rightType)
      assert.strictEqual(resultType?.kind, 'FacetType')
      assert.deepStrictEqual([...resultType.facets.keys()], [PatternFacet.name])

      const leftValue = PatternFacet.type().of(createSerialPattern([
        { value: 'C5', length: 2 as Numeric<'beats'> },
        { value: 'D5', length: 4 as Numeric<'beats'> }
      ]))
      const rightValue = Numbers.of(runtimeNumeric(undefined, 2))
      const resultValue = binaryOperations['/'].compute(leftValue, rightValue)
      assert.deepStrictEqual([...PatternFacet.get(resultValue).evaluate()], [
        { time: 0, pitch: 'C5', velocity: 1, gate: 1 },
        { time: 1, pitch: 'D5', velocity: 1, gate: 2 }
      ])
    })

    it('should reject NumberFacet left, PatternFacet right', () => {
      const leftType = NumberFacet.with(undefined).type()
      const rightType = PatternFacet.type()
      const resultType = binaryOperations['/'].check(leftType, rightType)
      assert.strictEqual(resultType, undefined)
    })

    it('should reject other facet types', () => {
      const testCases = [
        // with one of the supported operands
        [BooleanFacet.type(), NumberFacet.with(undefined).type()],
        [NumberFacet.with(undefined).type(), BooleanFacet.type()],
        [BooleanFacet.type(), PatternFacet.type()],
        [PatternFacet.type(), BooleanFacet.type()],
        // with two unsupported operands
        [BooleanFacet.type(), BooleanFacet.type()],
        [StringFacet.type(), StringFacet.type()]
      ]

      for (const [leftType, rightType] of testCases) {
        const resultType = binaryOperations['/'].check(leftType, rightType)
        assert.strictEqual(resultType, undefined)
      }
    })
  })

  for (const operator of ['==', '!='] as const) {
    describe(`operator "${operator}"`, () => {
      it('should accept equality comparable types', () => {
        const testCases = [
          [NumberFacet.with(undefined).type(), NumberFacet.with(undefined).type()],
          [NumberFacet.with('hz').type(), NumberFacet.with('hz').type()],
          [StringFacet.type(), StringFacet.type()],
          [BooleanFacet.type(), BooleanFacet.type()]
        ]

        for (const [leftType, rightType] of testCases) {
          const resultType = binaryOperations[operator].check(leftType, rightType)
          assert.strictEqual(resultType?.kind, 'FacetType')
          assert.deepStrictEqual([...resultType.facets.keys()], [BooleanFacet.name])
        }
      })

      it('should reject incompatible operands', () => {
        const testCases = [
          [NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()],
          [NumberFacet.with('hz').type(), NumberFacet.with(undefined).type()],
          [StringFacet.type(), BooleanFacet.type()],
          [BooleanFacet.type(), StringFacet.type()]
        ]

        for (const [leftType, rightType] of testCases) {
          const resultType = binaryOperations[operator].check(leftType, rightType)
          assert.strictEqual(resultType, undefined)
        }
      })

      it('should reject non-equality-comparable types', () => {
        const testCases = [
          [RecordFacet.type(), RecordFacet.type()],
          [PatternFacet.type(), PatternFacet.type()],
          [FunctionFacet.type(), FunctionFacet.type()]
        ]

        for (const [leftType, rightType] of testCases) {
          const resultType = binaryOperations[operator].check(leftType, rightType)
          assert.strictEqual(resultType, undefined)
        }
      })

      it('should compute (in)equality for comparable values', () => {
        const testCases = [
          [Numbers.of(runtimeNumeric('hz', 440)), Numbers.of(runtimeNumeric('hz', 440)), true],
          [Numbers.of(runtimeNumeric('hz', 440)), Numbers.of(runtimeNumeric('hz', 220)), false],
          [StringFacet.type().of('Hello'), StringFacet.type().of('Hello'), true],
          [StringFacet.type().of('Hello'), StringFacet.type().of('World'), false],
          [BooleanFacet.type().of(true), BooleanFacet.type().of(true), true],
          [BooleanFacet.type().of(true), BooleanFacet.type().of(false), false]
        ] as const

        for (const [leftValue, rightValue, expectedEqual] of testCases) {
          const resultValue = binaryOperations[operator].compute(leftValue, rightValue)

          const expectedResult = operator === '==' ? expectedEqual : !expectedEqual
          assert.strictEqual(BooleanFacet.get(resultValue), expectedResult)
        }
      })
    })
  }

  for (const operator of ['<', '<=', '>', '>='] as const) {
    describe(`operator "${operator}"`, () => {
      it('should accept relationally comparable types', () => {
        const testCases = [
          [NumberFacet.with(undefined).type(), NumberFacet.with(undefined).type()],
          [NumberFacet.with('hz').type(), NumberFacet.with('hz').type()]
        ]

        for (const [leftType, rightType] of testCases) {
          const resultType = binaryOperations[operator].check(leftType, rightType)
          assert.strictEqual(resultType?.kind, 'FacetType')
          assert.deepStrictEqual([...resultType.facets.keys()], [BooleanFacet.name])
        }
      })

      it('should reject incompatible operands', () => {
        const testCases = [
          [NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()],
          [NumberFacet.with('hz').type(), NumberFacet.with(undefined).type()],
          [StringFacet.type(), StringFacet.type()],
          [BooleanFacet.type(), BooleanFacet.type()]
        ]

        for (const [leftType, rightType] of testCases) {
          const resultType = binaryOperations[operator].check(leftType, rightType)
          assert.strictEqual(resultType, undefined)
        }
      })

      it('should compute relational ordering for comparable values', () => {
        interface TestCase {
          readonly left: number
          readonly right: number
          readonly expectedLessThan: boolean
          readonly expectedLessThanOrEqual: boolean
          readonly expectedGreaterThan: boolean
          readonly expectedGreaterThanOrEqual: boolean
        }

        const testCases: readonly TestCase[] = [
          {
            left: 0,
            right: 0,
            expectedLessThan: false,
            expectedLessThanOrEqual: true,
            expectedGreaterThan: false,
            expectedGreaterThanOrEqual: true
          },
          {
            left: 0,
            right: 1,
            expectedLessThan: true,
            expectedLessThanOrEqual: true,
            expectedGreaterThan: false,
            expectedGreaterThanOrEqual: false
          },
          {
            left: 1,
            right: 0,
            expectedLessThan: false,
            expectedLessThanOrEqual: false,
            expectedGreaterThan: true,
            expectedGreaterThanOrEqual: true
          },
          {
            left: -1,
            right: 1,
            expectedLessThan: true,
            expectedLessThanOrEqual: true,
            expectedGreaterThan: false,
            expectedGreaterThanOrEqual: false
          },
          {
            left: Number.NaN,
            right: Number.NaN,
            expectedLessThan: false,
            expectedLessThanOrEqual: false,
            expectedGreaterThan: false,
            expectedGreaterThanOrEqual: false
          },
          {
            left: Infinity,
            right: Infinity,
            expectedLessThan: false,
            expectedLessThanOrEqual: true,
            expectedGreaterThan: false,
            expectedGreaterThanOrEqual: true
          },
          {
            left: -Infinity,
            right: -Infinity,
            expectedLessThan: false,
            expectedLessThanOrEqual: true,
            expectedGreaterThan: false,
            expectedGreaterThanOrEqual: true
          },
          {
            left: Number.NaN,
            right: Infinity,
            expectedLessThan: false,
            expectedLessThanOrEqual: false,
            expectedGreaterThan: false,
            expectedGreaterThanOrEqual: false
          }
        ]

        for (const testCase of testCases) {
          const leftValue = Numbers.of(runtimeNumeric('hz', testCase.left))
          const rightValue = Numbers.of(runtimeNumeric('hz', testCase.right))

          const expectedResult = (() => {
            switch (operator) {
              case '<':
                return testCase.expectedLessThan
              case '<=':
                return testCase.expectedLessThanOrEqual
              case '>':
                return testCase.expectedGreaterThan
              case '>=':
                return testCase.expectedGreaterThanOrEqual
            }
          })()

          const resultValue = binaryOperations[operator].compute(leftValue, rightValue)
          assert.strictEqual(BooleanFacet.get(resultValue), expectedResult, `Failed for operator "${operator}" with left=${testCase.left} and right=${testCase.right}`)
        }
      })
    })
  }

  describe('operator "and"', () => {
    it('should accept boolean FacetType', () => {
      const result = binaryOperations.and.check(BooleanFacet.type(), BooleanFacet.type())
      assert.strictEqual(result, BooleanFacet.type())
    })

    it('should reject non-boolean FacetType', () => {
      const operands = [
        StringFacet.type(),
        NumberFacet.with(undefined).type()
      ]

      for (const operand of operands) {
        const result = binaryOperations.and.check(operand, operand)
        assert.strictEqual(result, undefined)
      }
    })

    it('should return the logical and value', () => {
      const testCases = [
        // left, right, expected
        [false, false, false],
        [false, true, false],
        [true, false, false],
        [true, true, true]
      ]

      for (const [left, right, expected] of testCases) {
        const leftValue = BooleanFacet.type().of(left)
        const rightValue = BooleanFacet.type().of(right)
        const result = binaryOperations.and.compute(leftValue, rightValue)
        assert.strictEqual(BooleanFacet.get(result), expected)
      }
    })
  })

  describe('operator "or"', () => {
    it('should accept boolean FacetType', () => {
      const result = binaryOperations.or.check(BooleanFacet.type(), BooleanFacet.type())
      assert.strictEqual(result, BooleanFacet.type())
    })

    it('should reject non-boolean FacetType', () => {
      const operands = [
        StringFacet.type(),
        NumberFacet.with(undefined).type()
      ]

      for (const operand of operands) {
        const result = binaryOperations.or.check(operand, operand)
        assert.strictEqual(result, undefined)
      }
    })

    it('should return the logical or value', () => {
      const testCases = [
        // left, right, expected
        [false, false, false],
        [false, true, true],
        [true, false, true],
        [true, true, true]
      ]

      for (const [left, right, expected] of testCases) {
        const leftValue = BooleanFacet.type().of(left)
        const rightValue = BooleanFacet.type().of(right)
        const result = binaryOperations.or.compute(leftValue, rightValue)
        assert.strictEqual(BooleanFacet.get(result), expected)
      }
    })
  })
})
