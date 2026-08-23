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
import { makeUnionType } from '../../../src/type-system/factory.ts'

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

    it('should accept UnionType exactly if both sides are compatible', () => {
      const testCases = [
        // operand, expected
        [
          makeUnionType(NumberFacet.with(undefined).type()),
          NumberFacet.with(undefined).type()
        ],
        [
          makeUnionType(NumberFacet.with('hz').type()),
          NumberFacet.with('hz').type()
        ],
        [
          makeUnionType(StringFacet.type()),
          StringFacet.type()
        ],
        [
          makeUnionType(PatternFacet.type()),
          PatternFacet.type()
        ]
      ]

      for (const [operand, expected] of testCases) {
        const result = binaryOperations['+'].check(operand, operand)
        assert.strictEqual(result?.kind, 'FacetType', `Expected operator "+" to accept operands: ${operand.format()}, ${operand.format()}`)
        assert.deepStrictEqual(result, expected)
      }

      for (const [left] of testCases) {
        for (const [right] of testCases) {
          if (left === right) {
            continue
          }

          const result = binaryOperations['+'].check(left, right)
          assert.strictEqual(result, undefined, `Expected operator "+" to reject operands: ${left.format()}, ${right.format()}`)
        }
      }
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

    it('should accept UnionType exactly if both sides are compatible', () => {
      const testCases = [
        // operand, expected
        [
          makeUnionType(NumberFacet.with(undefined).type()),
          NumberFacet.with(undefined).type()
        ],
        [
          makeUnionType(NumberFacet.with('hz').type()),
          NumberFacet.with('hz').type()
        ],
        [
          makeUnionType(NumberFacet.with('db').type()),
          NumberFacet.with('db').type()
        ]
      ]

      for (const [operand, expected] of testCases) {
        const result = binaryOperations['-'].check(operand, operand)
        assert.strictEqual(result?.kind, 'FacetType', `Expected operator "-" to accept operands: ${operand.format()}, ${operand.format()}`)
        assert.deepStrictEqual(result, expected)
      }

      for (const [left] of testCases) {
        for (const [right] of testCases) {
          if (left === right) {
            continue
          }

          const result = binaryOperations['-'].check(left, right)
          assert.strictEqual(result, undefined, `Expected operator "-" to reject operands: ${left.format()}, ${right.format()}`)
        }
      }
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
        assert.strictEqual(resultType, undefined, `Expected operator "*" to reject operands: ${leftType.format()}, ${rightType.format()}`)
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
        assert.strictEqual(resultType, undefined, `Expected operator "*" to reject operands: ${leftType.format()}, ${rightType.format()}`)
      }
    })

    it('should accept UnionType exactly if all members are valid operands', () => {
      const validTestCases = [
        // first, second, expected result
        [
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()),
          NumberFacet.with(undefined).type(),
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type())
        ],
        [
          makeUnionType(PatternFacet.type(), NumberFacet.with(undefined).type()),
          NumberFacet.with(undefined).type(),
          makeUnionType(PatternFacet.type(), NumberFacet.with(undefined).type())
        ]
      ] as const

      for (const [first, second, expectedResult] of validTestCases) {
        for (const [left, right] of [[first, second], [second, first]] as const) {
          const result = binaryOperations['*'].check(left, right)
          assert.strictEqual(result?.kind, 'UnionType')
          assert.deepStrictEqual(result.members, expectedResult.members)
        }
      }

      const invalidTestCases = [
        // first, second
        [
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()),
          NumberFacet.with('hz').type()
        ],
        [
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()),
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type())
        ],
        [
          makeUnionType(PatternFacet.type(), NumberFacet.with(undefined).type()),
          NumberFacet.with('hz').type()
        ]
      ] as const

      for (const [first, second] of invalidTestCases) {
        for (const [left, right] of [[first, second], [second, first]] as const) {
          const result = binaryOperations['*'].check(left, right)
          assert.strictEqual(result, undefined, `Expected operator "*" to reject operands: ${left.format()}, ${right.format()}`)
        }
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

    it('should accept UnionType exactly if all members are valid operands', () => {
      const validTestCases = [
        // left, right, expected result
        [
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()),
          NumberFacet.with(undefined).type(),
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type())
        ],
        [
          NumberFacet.with('hz').type(),
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()),
          makeUnionType(NumberFacet.with('hz').type(), NumberFacet.with(undefined).type())
        ],
        [
          makeUnionType(PatternFacet.type(), NumberFacet.with(undefined).type()),
          NumberFacet.with(undefined).type(),
          makeUnionType(PatternFacet.type(), NumberFacet.with(undefined).type())
        ]
      ] as const

      for (const [left, right, expectedResult] of validTestCases) {
        const result = binaryOperations['/'].check(left, right)
        assert.strictEqual(result?.kind, 'UnionType', `Expected operator "/" to accept operands: ${left.format()}, ${right.format()}`)
        assert.deepStrictEqual(result.members, expectedResult.members)
      }

      const invalidTestCases = [
        // left, right
        [
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()),
          NumberFacet.with('hz').type()
        ],
        [
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()),
          makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type())
        ],
        [
          makeUnionType(PatternFacet.type(), NumberFacet.with(undefined).type()),
          NumberFacet.with('hz').type()
        ]
      ] as const

      for (const [left, right] of invalidTestCases) {
        const result = binaryOperations['/'].check(left, right)
        assert.strictEqual(result, undefined, `Expected operator "/" to reject operands: ${left.format()}, ${right.format()}`)
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
          [Numbers.of(runtimeNumeric(undefined, Number.NaN)), Numbers.of(runtimeNumeric(undefined, Number.NaN)), false],
          [Numbers.of(runtimeNumeric(undefined, Infinity)), Numbers.of(runtimeNumeric(undefined, Infinity)), true],
          [Numbers.of(runtimeNumeric(undefined, -Infinity)), Numbers.of(runtimeNumeric(undefined, -Infinity)), true],
          [Numbers.of(runtimeNumeric(undefined, Infinity)), Numbers.of(runtimeNumeric(undefined, -Infinity)), false],
          [Numbers.of(runtimeNumeric('hz', 440)), Numbers.of(runtimeNumeric('hz', 440)), true],
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

      it('should accept UnionType if all members are comparable to all members of the other operand', () => {
        const testCases = [
          // first, second
          [
            makeUnionType(NumberFacet.with(undefined).type()),
            makeUnionType(NumberFacet.with(undefined).type())
          ],
          [
            makeUnionType(StringFacet.type()),
            makeUnionType(StringFacet.type())
          ],
          [
            makeUnionType(BooleanFacet.type()),
            makeUnionType(BooleanFacet.type())
          ]
        ]

        for (const [first, second] of testCases) {
          for (const [left, right] of [[first, second], [second, first]] as const) {
            const result = binaryOperations[operator].check(left, right)
            assert.strictEqual(result?.kind, 'FacetType')
            assert.deepStrictEqual([...result.facets.keys()], [BooleanFacet.name])
          }
        }
      })

      it('should reject UnionType if any member is not comparable to any member of the other operand', () => {
        const testCases = [
          // first, second
          [
            makeUnionType(NumberFacet.with(undefined).type(), StringFacet.type()),
            NumberFacet.with(undefined).type()
          ],
          [
            makeUnionType(NumberFacet.with(undefined).type(), StringFacet.type()),
            makeUnionType(NumberFacet.with(undefined).type(), StringFacet.type())
          ]
        ]

        for (const [first, second] of testCases) {
          for (const [left, right] of [[first, second], [second, first]] as const) {
            const result = binaryOperations[operator].check(left, right)
            assert.strictEqual(result, undefined)
          }
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

      it('should accept UnionType if all members are comparable to all members of the other operand', () => {
        const testCases = [
          // first, second
          [
            makeUnionType(NumberFacet.with(undefined).type()),
            makeUnionType(NumberFacet.with(undefined).type())
          ],
          [
            makeUnionType(NumberFacet.with('hz').type()),
            makeUnionType(NumberFacet.with('hz').type())
          ]
        ]

        for (const [first, second] of testCases) {
          for (const [left, right] of [[first, second], [second, first]] as const) {
            const result = binaryOperations[operator].check(left, right)
            assert.strictEqual(result?.kind, 'FacetType')
            assert.deepStrictEqual([...result.facets.keys()], [BooleanFacet.name])
          }
        }
      })

      it('should reject UnionType if any member is not comparable to any member of the other operand', () => {
        const testCases = [
          // first, second
          [
            makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()),
            NumberFacet.with(undefined).type()
          ],
          [
            makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type()),
            makeUnionType(NumberFacet.with(undefined).type(), NumberFacet.with('hz').type())
          ]
        ]

        for (const [first, second] of testCases) {
          for (const [left, right] of [[first, second], [second, first]] as const) {
            const result = binaryOperations[operator].check(left, right)
            assert.strictEqual(result, undefined)
          }
        }
      })
    })
  }

  for (const operator of ['and', 'or'] as const) {
    describe(`operator "${operator}"`, () => {
      it('should accept boolean FacetType', () => {
        const result = binaryOperations[operator].check(BooleanFacet.type(), BooleanFacet.type())
        assert.strictEqual(result, BooleanFacet.type())
      })

      it('should reject non-boolean FacetType', () => {
        const operands = [
          StringFacet.type(),
          NumberFacet.with(undefined).type()
        ]

        for (const operand of operands) {
          const result = binaryOperations[operator].check(operand, operand)
          assert.strictEqual(result, undefined)
        }
      })

      it('should return the logical and value', () => {
        const truthTable = {
          and: (a: boolean, b: boolean) => a && b,
          or: (a: boolean, b: boolean) => a || b
        }

        for (const left of [false, true]) {
          for (const right of [false, true]) {
            const leftValue = BooleanFacet.type().of(left)
            const rightValue = BooleanFacet.type().of(right)

            const result = binaryOperations[operator].compute(leftValue, rightValue)
            assert.strictEqual(
              BooleanFacet.get(result),
              truthTable[operator](left, right),
              `Failed for operator "${operator}" with left=${left} and right=${right}`
            )
          }
        }
      })

      it('should reject UnionType if any member is not boolean', () => {
        const validOperand = makeUnionType(BooleanFacet.type())
        const invalidOperand = makeUnionType(BooleanFacet.type(), StringFacet.type())

        // same operand on both sides
        assert.strictEqual(binaryOperations[operator].check(invalidOperand, invalidOperand), undefined)

        // valid operand on one side, invalid operand on the other
        assert.strictEqual(binaryOperations[operator].check(validOperand, invalidOperand), undefined)
        assert.strictEqual(binaryOperations[operator].check(invalidOperand, validOperand), undefined)
      })
    })
  }
})
