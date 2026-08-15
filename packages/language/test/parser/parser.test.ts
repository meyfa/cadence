import type { Token } from 'leac'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { lex } from '../../src/lexer/lexer.ts'
import { parse } from '../../src/parser/parser.ts'
import { assertResultComplete } from '../test-utils.ts'

/**
 * Lex the given string and return the resulting tokens. This assumes that the lexer
 * is implemented correctly.
 */
function lexSource (input: string, filePath?: string): Token[] {
  const result = lex(input, filePath)
  assert.ok(result.complete, result.complete ? undefined : result.error)

  return result.value
}

/**
 * Helper function to recursively strip source ranges from AST nodes for easier comparison in tests.
 */
function stripRanges (node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(stripRanges)
  }

  if (node != null && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => key !== 'range')
        .map(([key, value]) => [key, stripRanges(value)])
    )
  }

  return node
}

describe('parser/parser.ts', () => {
  it('should accept empty input', () => {
    const result = parse([])

    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: []
      }
    })
  })

  it('should parse imports', () => {
    const source = [
      'use "mylib" as myalias',
      'use "otherlib" as *'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.imports), [
      {
        type: 'Import',
        library: {
          type: 'String',
          parts: ['mylib']
        },
        alias: 'myalias'
      },
      {
        type: 'Import',
        library: {
          type: 'String',
          parts: ['otherlib']
        }
      }
    ])
  })

  it('should reject imports after other statements', () => {
    const source = [
      'foo = 42',
      'use "mylib" as myalias'
    ].join('\n')

    const result = parse(lexSource(source))

    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.message, 'Unexpected statement beginning with "use"')
  })

  it('should parse a simple assignment', () => {
    const result = parse(lexSource('foo = 42'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'foo' },
        values: [
          { type: 'Number', value: 42 }
        ]
      }
    ])
  })

  it('should parse a simple emission', () => {
    const result = parse(lexSource('& 42'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: true,
        expose: false,
        values: [
          { type: 'Number', value: 42 }
        ]
      }
    ])
  })

  it('should parse an emission assignment', () => {
    const result = parse(lexSource('& foo = 42'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: true,
        expose: false,
        name: { type: 'Identifier', name: 'foo' },
        values: [
          { type: 'Number', value: 42 }
        ]
      }
    ])
  })

  it('should parse a statement with multiple values', () => {
    const result = parse(lexSource('& 1, "hello", foo'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: true,
        expose: false,
        values: [
          { type: 'Number', value: 1 },
          { type: 'String', parts: ['hello'] },
          { type: 'Identifier', name: 'foo' }
        ]
      }
    ])
  })

  it('should reject assignments with multiple values', () => {
    const result = parse(lexSource('foo = 1, 2'))
    assert.strictEqual(result.complete, false)
  })

  it('should reject emission-assignments with multiple values', () => {
    const result = parse(lexSource('& foo = 1, 2'))
    assert.strictEqual(result.complete, false)
  })

  it('should parse exposed property assignments', () => {
    const result = parse(lexSource('@foo = 42'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: true,
        name: { type: 'Identifier', name: 'foo' },
        values: [
          { type: 'Number', value: 42 }
        ]
      }
    ])
  })

  it('should reject exposed property assignments with multiple values', () => {
    const result = parse(lexSource('@foo = 1, 2'))
    assert.strictEqual(result.complete, false)
  })

  it('should parse unit suffixes', () => {
    const source = [
      'offset = -1.5.ms',
      'gain = (-6 + 3).db'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'offset' },
        values: [
          {
            type: 'UnaryExpression',
            operator: '-',
            operand: {
              type: 'PropertyAccess',
              object: { type: 'Number', value: 1.5 },
              property: { type: 'Identifier', name: 'ms' }
            }
          }
        ]
      },
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'gain' },
        values: [
          {
            type: 'PropertyAccess',
            object: {
              type: 'BinaryExpression',
              operator: '+',
              left: { type: 'Number', value: -6 },
              right: { type: 'Number', value: 3 }
            },
            property: { type: 'Identifier', name: 'db' }
          }
        ]
      }
    ])
  })

  it('should parse boolean literals', () => {
    const source = [
      'flag1 = true',
      'flag2 = false'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'flag1' },
        values: [
          { type: 'Boolean', value: true }
        ]
      },
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'flag2' },
        values: [
          { type: 'Boolean', value: false }
        ]
      }
    ])
  })

  it('should reject boolean literals on left-hand side of assignment', () => {
    for (const lhs of ['true', 'false']) {
      for (const rhs of ['true', 'false', '0', '1', '"string"']) {
        const result = parse(lexSource(`${lhs} = ${rhs}`))
        assert.strictEqual(result.complete, false)
        assert.strictEqual(result.error.message, `Unexpected statement beginning with "${lhs}"`)
      }
    }
  })

  it('should parse string literals with escapes and interpolations', () => {
    const result = parse(lexSource('foo = "a \\{ b {x} c"'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'foo' },
        values: [
          {
            type: 'String',
            parts: [
              'a { b ',
              { type: 'Identifier', name: 'x' },
              ' c'
            ]
          }
        ]
      }
    ])
  })

  it('should parse record values', () => {
    const source = [
      'empty_record = {}',
      'one_field = { @key = "value" }',
      'complex = {',
      '  scratch = 42',
      '  @foo = { @bar = scratch }',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'empty_record' },
        values: [
          {
            type: 'RecordValue',
            children: []
          }
        ]
      },
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'one_field' },
        values: [
          {
            type: 'RecordValue',
            children: [
              {
                type: 'SimpleStatement',
                emit: false,
                expose: true,
                name: { type: 'Identifier', name: 'key' },
                values: [
                  { type: 'String', parts: ['value'] }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'complex' },
        values: [
          {
            type: 'RecordValue',
            children: [
              {
                type: 'SimpleStatement',
                emit: false,
                expose: false,
                name: { type: 'Identifier', name: 'scratch' },
                values: [
                  { type: 'Number', value: 42 }
                ]
              },
              {
                type: 'SimpleStatement',
                emit: false,
                expose: true,
                name: { type: 'Identifier', name: 'foo' },
                values: [
                  {
                    type: 'RecordValue',
                    children: [
                      {
                        type: 'SimpleStatement',
                        emit: false,
                        expose: true,
                        name: { type: 'Identifier', name: 'bar' },
                        values: [
                          { type: 'Identifier', name: 'scratch' }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ])
  })

  it('should parse a serial pattern', () => {
    const result = parse(lexSource('foo = [xx-D4:0.5-G4]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'foo' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'x', arguments: [] },
              { type: 'Step', value: 'x', arguments: [] },
              { type: 'Step', value: '-', arguments: [] },
              { type: 'Step', value: 'D4', length: { type: 'Number', value: 0.5 }, arguments: [] },
              { type: 'Step', value: '-', arguments: [] },
              { type: 'Step', value: 'G4', arguments: [] }
            ]
          }
        ]
      }
    ])
  })

  it('should parse an empty serial pattern', () => {
    const result = parse(lexSource('foo = []'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'foo' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: []
          }
        ]
      }
    ])
  })

  it('should parse a pattern with gate', () => {
    const result = parse(lexSource('pattern = [C4(2.0)-]'))
    assertResultComplete(result)

    const gate = {
      type: 'Argument',
      value: { type: 'Number', value: 2.0 }
    }

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'C4', arguments: [gate] },
              { type: 'Step', value: '-', arguments: [] }
            ]
          }
        ]
      }
    ])
  })

  it('should parse a pattern with gate and length', () => {
    const result = parse(lexSource('pattern = [C4(2.0):1.5-]'))
    assertResultComplete(result)

    const gate = {
      type: 'Argument',
      value: { type: 'Number', value: 2.0 }
    }
    const length = { type: 'Number', value: 1.5 }

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'C4', length, arguments: [gate] },
              { type: 'Step', value: '-', arguments: [] }
            ]
          }
        ]
      }
    ])
  })

  it('should parse a pattern with gate and velocity', () => {
    const result = parse(lexSource('pattern = [C4(2.0, 0.75):1.5-]'))
    assertResultComplete(result)

    const gate = {
      type: 'Argument',
      value: { type: 'Number', value: 2.0 }
    }
    const velocity = {
      type: 'Argument',
      value: { type: 'Number', value: 0.75 }
    }
    const length = { type: 'Number', value: 1.5 }

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'C4', length, arguments: [gate, velocity] },
              { type: 'Step', value: '-', arguments: [] }
            ]
          }
        ]
      }
    ])
  })

  it('should parse a pattern with a single named parameter', () => {
    const result = parse(lexSource('pattern = [C4(gate: 2.0):1.5-]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              {
                type: 'Step',
                value: 'C4',
                length: { type: 'Number', value: 1.5 },
                arguments: [
                  {
                    type: 'Argument',
                    name: { type: 'Identifier', name: 'gate' },
                    value: { type: 'Number', value: 2.0 }
                  }
                ]
              },
              { type: 'Step', value: '-', arguments: [] }
            ]
          }
        ]
      }
    ])
  })

  it('should parse a pattern with multiple named parameters', () => {
    const result = parse(lexSource('pattern = [C4(vel: 0.75, gate: 2.0):1.5-]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              {
                type: 'Step',
                value: 'C4',
                length: { type: 'Number', value: 1.5 },
                arguments: [
                  {
                    type: 'Argument',
                    name: { type: 'Identifier', name: 'vel' },
                    value: { type: 'Number', value: 0.75 }
                  },
                  {
                    type: 'Argument',
                    name: { type: 'Identifier', name: 'gate' },
                    value: { type: 'Number', value: 2.0 }
                  }
                ]
              },
              { type: 'Step', value: '-', arguments: [] }
            ]
          }
        ]
      }
    ])
  })

  it('should parse a pattern with parallel steps', () => {
    const result = parse(lexSource('pattern = [<C4:0.75-:0.25>E4]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              {
                type: 'Pattern',
                mode: 'parallel',
                children: [
                  {
                    type: 'Step',
                    value: 'C4',
                    length: { type: 'Number', value: 0.75 },
                    arguments: []
                  },
                  {
                    type: 'Step',
                    value: '-',
                    length: { type: 'Number', value: 0.25 },
                    arguments: []
                  }
                ]
              },
              {
                type: 'Step',
                value: 'E4',
                arguments: []
              }
            ]
          }
        ]
      }
    ])
  })

  it('should reject empty parallel patterns', () => {
    const result = parse(lexSource('pattern = [<>]'))
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.message, 'Unexpected "<"; expected "]"')
  })

  it('should parse patterns with interpolations', () => {
    const result = parse(lexSource('pattern = [C4-{some_pattern * 2}]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'C4', arguments: [] },
              { type: 'Step', value: '-', arguments: [] },
              {
                type: 'BinaryExpression',
                operator: '*',
                left: { type: 'Identifier', name: 'some_pattern' },
                right: { type: 'Number', value: 2 }
              }
            ]
          }
        ]
      }
    ])
  })

  it('should preserve file paths in split pattern step ranges', () => {
    const result = parse(lexSource('pattern = [xx:1]', 'track.cadence'))
    assertResultComplete(result)

    const assignment = result.value.children[0]
    assert.strictEqual(assignment.type, 'SimpleStatement')
    assert.strictEqual(assignment.values[0].type, 'Pattern')
    assert.strictEqual(assignment.values[0].children[1]?.range.filePath, 'track.cadence')
  })

  it('should parse instrument routing expressions', () => {
    const result = parse(lexSource('& play(drums, my_pattern)'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: true,
        expose: false,
        values: [
          {
            type: 'Call',
            callee: { type: 'Identifier', name: 'play' },
            arguments: [
              {
                type: 'Argument',
                value: { type: 'Identifier', name: 'drums' }
              },
              {
                type: 'Argument',
                value: { type: 'Identifier', name: 'my_pattern' }
              }
            ]
          }
        ]
      }
    ])
  })

  it('should parse property access expressions', () => {
    const nonParenthesized = 'x = object.foo.bar'

    const parenthesized = 'x = (object.foo).bar'

    for (const source of [nonParenthesized, parenthesized]) {
      const result = parse(lexSource(source))
      assertResultComplete(result)

      assert.deepStrictEqual(stripRanges(result.value.children), [
        {
          type: 'SimpleStatement',
          emit: false,
          expose: false,
          name: { type: 'Identifier', name: 'x' },
          values: [
            {
              type: 'PropertyAccess',
              object: {
                type: 'PropertyAccess',
                object: { type: 'Identifier', name: 'object' },
                property: { type: 'Identifier', name: 'foo' }
              },
              property: { type: 'Identifier', name: 'bar' }
            }
          ]
        }
      ])
    }
  })

  it('should parse curve expressions', () => {
    const result = parse(lexSource('foo = ~[hold(0):1.bar lin(0, 1):2.beats]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'foo' },
        values: [
          {
            type: 'Curve',
            children: [
              {
                type: 'CurveSegment',
                curveType: 'hold',
                arguments: [
                  { type: 'Number', value: 0 }
                ],
                length: {
                  type: 'PropertyAccess',
                  object: { type: 'Number', value: 1 },
                  property: { type: 'Identifier', name: 'bar' }
                }
              },
              {
                type: 'CurveSegment',
                curveType: 'lin',
                arguments: [
                  { type: 'Number', value: 0 },
                  { type: 'Number', value: 1 }
                ],
                length: {
                  type: 'PropertyAccess',
                  object: { type: 'Number', value: 2 },
                  property: { type: 'Identifier', name: 'beats' }
                }
              }
            ]
          }
        ]
      }
    ])
  })

  it('should parse curve segments without parameters', () => {
    const result = parse(lexSource('foo = ~[hold:1.bar hold:2.bars]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'foo' },
        values: [
          {
            type: 'Curve',
            children: [
              {
                type: 'CurveSegment',
                curveType: 'hold',
                arguments: [],
                length: {
                  type: 'PropertyAccess',
                  object: { type: 'Number', value: 1 },
                  property: { type: 'Identifier', name: 'bar' }
                }
              },
              {
                type: 'CurveSegment',
                curveType: 'hold',
                arguments: [],
                length: {
                  type: 'PropertyAccess',
                  object: { type: 'Number', value: 2 },
                  property: { type: 'Identifier', name: 'bars' }
                }
              }
            ]
          }
        ]
      }
    ])
  })

  it('should reject curve segments that omit the length', () => {
    const result = parse(lexSource('foo = ~[hold(0) lin(1, 2):1.bar]'))
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.message, 'Curve segment "hold" is missing a length')
  })

  it('should parse property access with function calls', () => {
    const nonParenthesized = 'x = object.method1().method2()'
    const parenthesized = 'x = (object.method1()).method2()'

    for (const source of [nonParenthesized, parenthesized]) {
      const result = parse(lexSource(source))
      assertResultComplete(result)

      assert.deepStrictEqual(stripRanges(result.value.children), [
        {
          type: 'SimpleStatement',
          emit: false,
          expose: false,
          name: { type: 'Identifier', name: 'x' },
          values: [
            {
              type: 'Call',
              callee: {
                type: 'PropertyAccess',
                object: {
                  type: 'Call',
                  callee: {
                    type: 'PropertyAccess',
                    object: { type: 'Identifier', name: 'object' },
                    property: { type: 'Identifier', name: 'method1' }
                  },
                  arguments: []
                },
                property: { type: 'Identifier', name: 'method2' }
              },
              arguments: []
            }
          ]
        }
      ])
    }
  })

  it('should parse calling the result of a call', () => {
    const result = parse(lexSource('x = factory()(arg1, arg2)'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'x' },
        values: [
          {
            type: 'Call',
            callee: {
              type: 'Call',
              callee: { type: 'Identifier', name: 'factory' },
              arguments: []
            },
            arguments: [
              {
                type: 'Argument',
                value: { type: 'Identifier', name: 'arg1' }
              },
              {
                type: 'Argument',
                value: { type: 'Identifier', name: 'arg2' }
              }
            ]
          }
        ]
      }
    ])
  })

  it('should parse parameterless functions', () => {
    const result = parse(lexSource('my_func = () { & 42 }'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'my_func' },
        values: [
          {
            type: 'Function',
            parameters: [],
            children: [
              {
                type: 'SimpleStatement',
                emit: true,
                expose: false,
                values: [
                  { type: 'Number', value: 42 }
                ]
              }
            ]
          }
        ]
      }
    ])
  })

  it('should parse functions with parameters', () => {
    const source = [
      'my_func = (param1: number.db, param2: string) {',
      '  & param1, param2',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'my_func' },
        values: [
          {
            type: 'Function',
            parameters: [
              {
                type: 'Parameter',
                name: { type: 'Identifier', name: 'param1' },
                parameterType: {
                  type: 'NamedType',
                  name: { type: 'Identifier', name: 'number' },
                  generics: [
                    { type: 'Identifier', name: 'db' }
                  ]
                },
                optional: false
              },
              {
                type: 'Parameter',
                name: { type: 'Identifier', name: 'param2' },
                parameterType: {
                  type: 'NamedType',
                  name: { type: 'Identifier', name: 'string' },
                  generics: []
                },
                optional: false
              }
            ],
            children: [
              {
                type: 'SimpleStatement',
                emit: true,
                expose: false,
                values: [
                  { type: 'Identifier', name: 'param1' },
                  { type: 'Identifier', name: 'param2' }
                ]
              }
            ]
          }
        ]
      }
    ])
  })

  it('should parse empty record types', () => {
    const result = parse(lexSource('func = (p: {}) { & 42 }'))
    assertResultComplete(result)

    const statement = result.value.children.at(0)
    assert.strictEqual(statement?.type, 'SimpleStatement')

    const func = statement.values.at(0)
    assert.strictEqual(func?.type, 'Function')

    assert.deepStrictEqual(stripRanges(func.parameters), [
      {
        type: 'Parameter',
        name: { type: 'Identifier', name: 'p' },
        parameterType: {
          type: 'RecordType',
          properties: []
        },
        optional: false
      }
    ])
  })

  it('should parse named types', () => {
    const result = parse(lexSource('foo = (x: track, y: part, z: instrument) {}'))
    assertResultComplete(result)

    const statement = result.value.children.at(0)
    assert.strictEqual(statement?.type, 'SimpleStatement')

    const func = statement.values.at(0)
    assert.strictEqual(func?.type, 'Function')

    assert.deepStrictEqual(stripRanges(func.parameters), [
      {
        type: 'Parameter',
        name: { type: 'Identifier', name: 'x' },
        parameterType: {
          type: 'NamedType',
          name: { type: 'Identifier', name: 'track' },
          generics: []
        },
        optional: false
      },
      {
        type: 'Parameter',
        name: { type: 'Identifier', name: 'y' },
        parameterType: {
          type: 'NamedType',
          name: { type: 'Identifier', name: 'part' },
          generics: []
        },
        optional: false
      },
      {
        type: 'Parameter',
        name: { type: 'Identifier', name: 'z' },
        parameterType: {
          type: 'NamedType',
          name: { type: 'Identifier', name: 'instrument' },
          generics: []
        },
        optional: false
      }
    ])
  })

  it('should parse complex type expressions', () => {
    const source = [
      'foo = (x: number.db + (format: string): string, fmt?: string) {}',
      'bar = (y: ((number.db) + (format: string): (string + string))) {}',
      'baz = (z: (): instrument !hello !world + {foo: number, bar: string}) {}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    const fooStatement = result.value.children.at(0)
    assert.strictEqual(fooStatement?.type, 'SimpleStatement')

    const foo = fooStatement.values.at(0)
    assert.strictEqual(foo?.type, 'Function')

    assert.deepStrictEqual(stripRanges(foo.parameters), [
      {
        type: 'Parameter',
        name: { type: 'Identifier', name: 'x' },
        parameterType: {
          type: 'CombinedType',
          children: [
            {
              type: 'NamedType',
              name: { type: 'Identifier', name: 'number' },
              generics: [
                { type: 'Identifier', name: 'db' }
              ]
            },
            {
              type: 'FunctionType',
              parameters: [
                {
                  type: 'Parameter',
                  name: { type: 'Identifier', name: 'format' },
                  parameterType: {
                    type: 'NamedType',
                    name: { type: 'Identifier', name: 'string' },
                    generics: []
                  },
                  optional: false
                }
              ],
              returnType: {
                type: 'NamedType',
                name: { type: 'Identifier', name: 'string' },
                generics: []
              },
              capabilities: []
            }
          ]
        },
        optional: false
      },
      {
        type: 'Parameter',
        name: { type: 'Identifier', name: 'fmt' },
        parameterType: {
          type: 'NamedType',
          name: { type: 'Identifier', name: 'string' },
          generics: []
        },
        optional: true
      }
    ])

    const barStatement = result.value.children.at(1)
    assert.strictEqual(barStatement?.type, 'SimpleStatement')

    const bar = barStatement.values.at(0)
    assert.strictEqual(bar?.type, 'Function')

    assert.deepStrictEqual(stripRanges(bar.parameters), [
      {
        type: 'Parameter',
        name: { type: 'Identifier', name: 'y' },
        parameterType: {
          type: 'CombinedType',
          children: [
            {
              type: 'NamedType',
              name: { type: 'Identifier', name: 'number' },
              generics: [
                { type: 'Identifier', name: 'db' }
              ]
            },
            {
              type: 'FunctionType',
              parameters: [
                {
                  type: 'Parameter',
                  name: { type: 'Identifier', name: 'format' },
                  parameterType: {
                    type: 'NamedType',
                    name: { type: 'Identifier', name: 'string' },
                    generics: []
                  },
                  optional: false
                }
              ],
              returnType: {
                type: 'CombinedType',
                children: [
                  {
                    type: 'NamedType',
                    name: { type: 'Identifier', name: 'string' },
                    generics: []
                  },
                  {
                    type: 'NamedType',
                    name: { type: 'Identifier', name: 'string' },
                    generics: []
                  }
                ]
              },
              capabilities: []
            }
          ]
        },
        optional: false
      }
    ])

    const bazStatement = result.value.children.at(2)
    assert.strictEqual(bazStatement?.type, 'SimpleStatement')

    const baz = bazStatement.values.at(0)
    assert.strictEqual(baz?.type, 'Function')

    assert.deepStrictEqual(stripRanges(baz.parameters), [
      {
        type: 'Parameter',
        name: { type: 'Identifier', name: 'z' },
        parameterType: {
          type: 'CombinedType',
          children: [
            {
              type: 'FunctionType',
              parameters: [],
              returnType: {
                type: 'NamedType',
                name: { type: 'Identifier', name: 'instrument' },
                generics: []
              },
              capabilities: [
                { type: 'Identifier', name: 'hello' },
                { type: 'Identifier', name: 'world' }
              ]
            },
            {
              type: 'RecordType',
              properties: [
                {
                  type: 'RecordTypeProperty',
                  name: { type: 'Identifier', name: 'foo' },
                  propertyType: {
                    type: 'NamedType',
                    name: { type: 'Identifier', name: 'number' },
                    generics: []
                  }
                },
                {
                  type: 'RecordTypeProperty',
                  name: { type: 'Identifier', name: 'bar' },
                  propertyType: {
                    type: 'NamedType',
                    name: { type: 'Identifier', name: 'string' },
                    generics: []
                  }
                }
              ]
            }
          ]
        },
        optional: false
      }
    ])
  })

  it('should attach capabilities to the nearest function type', () => {
    const result = parse(lexSource('f = (p: (): (): number !foo !bar) {}'))
    assertResultComplete(result)

    const statement = result.value.children.at(0)
    assert.strictEqual(statement?.type, 'SimpleStatement')

    const func = statement.values.at(0)
    assert.strictEqual(func?.type, 'Function')

    assert.deepStrictEqual(stripRanges(func.parameters), [
      {
        type: 'Parameter',
        name: { type: 'Identifier', name: 'p' },
        parameterType: {
          type: 'FunctionType',
          parameters: [],
          returnType: {
            type: 'FunctionType',
            parameters: [],
            returnType: {
              type: 'NamedType',
              name: { type: 'Identifier', name: 'number' },
              generics: []
            },
            capabilities: [
              { type: 'Identifier', name: 'foo' },
              { type: 'Identifier', name: 'bar' }
            ]
          },
          capabilities: []
        },
        optional: false
      }
    ])
  })

  it('should parse mixer and buses', () => {
    const source = [
      '& mixer {',
      '  & bus (gain: (-3).db) {',
      '    & kick, snare, hihat',
      '    & fx.pan(0.5)',
      '    & @lp = fx.lowpass(400.hz)',
      '  }',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.strictEqual(result.value.children.length, 1)
    assert.strictEqual(result.value.children[0].type, 'SimpleStatement')

    const emissions = result.value.children[0].values

    assert.deepStrictEqual(stripRanges(emissions), [
      {
        type: 'Mixer',
        arguments: [],
        children: [
          {
            type: 'SimpleStatement',
            emit: true,
            expose: false,
            values: [
              {
                type: 'Bus',
                arguments: [
                  {
                    type: 'Argument',
                    name: { type: 'Identifier', name: 'gain' },
                    value: {
                      type: 'PropertyAccess',
                      object: { type: 'Number', value: -3 },
                      property: { type: 'Identifier', name: 'db' }
                    }
                  }
                ],
                children: [
                  {
                    type: 'SimpleStatement',
                    emit: true,
                    expose: false,
                    values: [
                      { type: 'Identifier', name: 'kick' },
                      { type: 'Identifier', name: 'snare' },
                      { type: 'Identifier', name: 'hihat' }
                    ]
                  },
                  {
                    type: 'SimpleStatement',
                    emit: true,
                    expose: false,
                    values: [
                      {
                        type: 'Call',
                        callee: {
                          type: 'PropertyAccess',
                          object: { type: 'Identifier', name: 'fx' },
                          property: { type: 'Identifier', name: 'pan' }
                        },
                        arguments: [
                          {
                            type: 'Argument',
                            value: { type: 'Number', value: 0.5 }
                          }
                        ]
                      }
                    ]
                  },
                  {
                    type: 'SimpleStatement',
                    emit: true,
                    expose: true,
                    name: { type: 'Identifier', name: 'lp' },
                    values: [
                      {
                        type: 'Call',
                        callee: {
                          type: 'PropertyAccess',
                          object: { type: 'Identifier', name: 'fx' },
                          property: { type: 'Identifier', name: 'lowpass' }
                        },
                        arguments: [
                          {
                            type: 'Argument',
                            value: {
                              type: 'PropertyAccess',
                              object: { type: 'Number', value: 400 },
                              property: { type: 'Identifier', name: 'hz' }
                            }
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ])
  })

  it('should parse track and parts', () => {
    const source = [
      '& track {',
      '  & part (4.bars) {}',
      '  & part (2.bars) {}',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.strictEqual(result.value.children[0].type, 'SimpleStatement')
    assert.strictEqual(result.value.children[0].emit, true)

    const emissions = result.value.children[0].values

    assert.deepStrictEqual(stripRanges(emissions), [
      {
        type: 'Track',
        arguments: [],
        children: [
          {
            type: 'SimpleStatement',
            emit: true,
            expose: false,
            values: [
              {
                type: 'Part',
                arguments: [
                  {
                    type: 'Argument',
                    value: {
                      type: 'PropertyAccess',
                      object: { type: 'Number', value: 4 },
                      property: { type: 'Identifier', name: 'bars' }
                    }
                  }
                ],
                children: []
              }
            ]
          },
          {
            type: 'SimpleStatement',
            emit: true,
            expose: false,
            values: [
              {
                type: 'Part',
                arguments: [
                  {
                    type: 'Argument',
                    value: {
                      type: 'PropertyAccess',
                      object: { type: 'Number', value: 2 },
                      property: { type: 'Identifier', name: 'bars' }
                    }
                  }
                ],
                children: []
              }
            ]
          }
        ]
      }
    ])
  })

  it('should allow assignments in track and mixer bodies', () => {
    const source = [
      '& track {',
      '  foo = 42',
      '}',
      '& mixer {',
      '  bar = 43',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: true,
        expose: false,
        values: [
          {
            type: 'Track',
            arguments: [],
            children: [
              {
                type: 'SimpleStatement',
                emit: false,
                expose: false,
                name: { type: 'Identifier', name: 'foo' },
                values: [
                  { type: 'Number', value: 42 }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'SimpleStatement',
        emit: true,
        expose: false,
        values: [
          {
            type: 'Mixer',
            arguments: [],
            children: [
              {
                type: 'SimpleStatement',
                emit: false,
                expose: false,
                name: { type: 'Identifier', name: 'bar' },
                values: [
                  { type: 'Number', value: 43 }
                ]
              }
            ]
          }
        ]
      }
    ])
  })

  it('should parse instrument expressions', () => {
    const source = [
      'my_synth = instrument {',
      '  foo = -6.db',
      '  & voice {',
      '    bar = 440.hz',
      '  }',
      '  & voice note {}',
      '}',
      '',
      'labeled_instrument = instrument ("my_label") {}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'my_synth' },
        values: [
          {
            type: 'Instrument',
            arguments: [],
            children: [
              {
                type: 'SimpleStatement',
                emit: false,
                expose: false,
                name: { type: 'Identifier', name: 'foo' },
                values: [
                  {
                    type: 'UnaryExpression',
                    operator: '-',
                    operand: {
                      type: 'PropertyAccess',
                      object: { type: 'Number', value: 6 },
                      property: { type: 'Identifier', name: 'db' }
                    }
                  }
                ]
              },
              {
                type: 'SimpleStatement',
                emit: true,
                expose: false,
                values: [
                  {
                    type: 'Voice',
                    bindings: {
                      note: undefined
                    },
                    children: [
                      {
                        type: 'SimpleStatement',
                        emit: false,
                        expose: false,
                        name: { type: 'Identifier', name: 'bar' },
                        values: [
                          {
                            type: 'PropertyAccess',
                            object: { type: 'Number', value: 440 },
                            property: { type: 'Identifier', name: 'hz' }
                          }
                        ]
                      }
                    ]
                  }
                ]
              },
              {
                type: 'SimpleStatement',
                emit: true,
                expose: false,
                values: [
                  {
                    type: 'Voice',
                    bindings: {
                      note: { type: 'Identifier', name: 'note' }
                    },
                    children: []
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        type: 'SimpleStatement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'labeled_instrument' },
        values: [
          {
            type: 'Instrument',
            arguments: [
              {
                type: 'Argument',
                value: {
                  type: 'String',
                  parts: ['my_label']
                }
              }
            ],
            children: []
          }
        ]
      }
    ])
  })

  it('should parse if statements', () => {
    const source = [
      'if condition {',
      '  & 42',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'IfStatement',
        branches: [
          {
            type: 'ConditionalBranch',
            condition: { type: 'Identifier', name: 'condition' },
            children: [
              {
                type: 'SimpleStatement',
                emit: true,
                expose: false,
                values: [
                  { type: 'Number', value: 42 }
                ]
              }
            ]
          }
        ],
        elseBranch: undefined
      }
    ])
  })

  it('should parse if-else statements', () => {
    const source = [
      'if condition {',
      '  & 42',
      '}, else {',
      '  & 43',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'IfStatement',
        branches: [
          {
            type: 'ConditionalBranch',
            condition: { type: 'Identifier', name: 'condition' },
            children: [
              {
                type: 'SimpleStatement',
                emit: true,
                expose: false,
                values: [
                  { type: 'Number', value: 42 }
                ]
              }
            ]
          }
        ],
        elseBranch: [
          {
            type: 'SimpleStatement',
            emit: true,
            expose: false,
            values: [
              { type: 'Number', value: 43 }
            ]
          }
        ]
      }
    ])
  })

  it('should parse if statements with multiple branches', () => {
    const source = [
      'if condition0 {',
      '  & 42',
      '}, condition1 {',
      '  & 43',
      '}, condition2 {',
      '  & 44',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'IfStatement',
        branches: [
          {
            type: 'ConditionalBranch',
            condition: { type: 'Identifier', name: 'condition0' },
            children: [
              {
                type: 'SimpleStatement',
                emit: true,
                expose: false,
                values: [
                  { type: 'Number', value: 42 }
                ]
              }
            ]
          },
          {
            type: 'ConditionalBranch',
            condition: { type: 'Identifier', name: 'condition1' },
            children: [
              {
                type: 'SimpleStatement',
                emit: true,
                expose: false,
                values: [
                  { type: 'Number', value: 43 }
                ]
              }
            ]
          },
          {
            type: 'ConditionalBranch',
            condition: { type: 'Identifier', name: 'condition2' },
            children: [
              {
                type: 'SimpleStatement',
                emit: true,
                expose: false,
                values: [
                  { type: 'Number', value: 44 }
                ]
              }
            ]
          }
        ],
        elseBranch: undefined
      }
    ])

    assert.deepStrictEqual(result.value.children[0].range, {
      offset: 0,
      length: source.length,
      line: 1,
      column: 1
    })
  })

  it('should reject if-else statements without comma', () => {
    const result = parse(lexSource('if condition {} else {}'))
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.message, 'Unexpected statement beginning with "else"')
  })

  it('should reject imports within if statements', () => {
    const source = [
      'if condition {',
      '  import "foo"',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.message, 'Unexpected "import"; expected "}"')
  })
})
