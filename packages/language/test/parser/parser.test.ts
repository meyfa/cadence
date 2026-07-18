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
        type: 'Statement',
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
        type: 'Statement',
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
        type: 'Statement',
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
        type: 'Statement',
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
        type: 'Statement',
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
        type: 'Statement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'offset' },
        values: [
          {
            type: 'UnaryExpression',
            operator: '-',
            argument: {
              type: 'PropertyAccess',
              object: { type: 'Number', value: 1.5 },
              property: { type: 'Identifier', name: 'ms' }
            }
          }
        ]
      },
      {
        type: 'Statement',
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

  it('should parse explicit bus parameter access', () => {
    const result = parse(lexSource('target = bus.main.gain'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Statement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'target' },
        values: [
          {
            type: 'PropertyAccess',
            object: {
              type: 'PropertyAccess',
              object: { type: 'Identifier', name: 'bus' },
              property: { type: 'Identifier', name: 'main' }
            },
            property: { type: 'Identifier', name: 'gain' }
          }
        ]
      }
    ])
  })

  it('should parse string literals with escapes and interpolations', () => {
    const result = parse(lexSource('foo = "a \\{ b {x} c"'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Statement',
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

  it('should parse a serial pattern', () => {
    const result = parse(lexSource('foo = [xx-D4:0.5-G4]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Statement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'foo' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'x', parameters: [] },
              { type: 'Step', value: 'x', parameters: [] },
              { type: 'Step', value: '-', parameters: [] },
              { type: 'Step', value: 'D4', length: { type: 'Number', value: 0.5 }, parameters: [] },
              { type: 'Step', value: '-', parameters: [] },
              { type: 'Step', value: 'G4', parameters: [] }
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
        type: 'Statement',
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

    const gate = { type: 'Number', value: 2.0 }

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Statement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'C4', parameters: [gate] },
              { type: 'Step', value: '-', parameters: [] }
            ]
          }
        ]
      }
    ])
  })

  it('should parse a pattern with gate and length', () => {
    const result = parse(lexSource('pattern = [C4(2.0):1.5-]'))
    assertResultComplete(result)

    const gate = { type: 'Number', value: 2.0 }
    const length = { type: 'Number', value: 1.5 }

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Statement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'C4', length, parameters: [gate] },
              { type: 'Step', value: '-', parameters: [] }
            ]
          }
        ]
      }
    ])
  })

  it('should parse a pattern with gate and velocity', () => {
    const result = parse(lexSource('pattern = [C4(2.0, 0.75):1.5-]'))
    assertResultComplete(result)

    const gate = { type: 'Number', value: 2.0 }
    const velocity = { type: 'Number', value: 0.75 }
    const length = { type: 'Number', value: 1.5 }

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Statement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'C4', length, parameters: [gate, velocity] },
              { type: 'Step', value: '-', parameters: [] }
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
        type: 'Statement',
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
                parameters: [
                  {
                    type: 'Property',
                    key: { type: 'Identifier', name: 'gate' },
                    value: { type: 'Number', value: 2.0 }
                  }
                ]
              },
              { type: 'Step', value: '-', parameters: [] }
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
        type: 'Statement',
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
                parameters: [
                  {
                    type: 'Property',
                    key: { type: 'Identifier', name: 'vel' },
                    value: { type: 'Number', value: 0.75 }
                  },
                  {
                    type: 'Property',
                    key: { type: 'Identifier', name: 'gate' },
                    value: { type: 'Number', value: 2.0 }
                  }
                ]
              },
              { type: 'Step', value: '-', parameters: [] }
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
        type: 'Statement',
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
                    parameters: []
                  },
                  {
                    type: 'Step',
                    value: '-',
                    length: { type: 'Number', value: 0.25 },
                    parameters: []
                  }
                ]
              },
              {
                type: 'Step',
                value: 'E4',
                parameters: []
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
        type: 'Statement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'pattern' },
        values: [
          {
            type: 'Pattern',
            mode: 'serial',
            children: [
              { type: 'Step', value: 'C4', parameters: [] },
              { type: 'Step', value: '-', parameters: [] },
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
    assert.strictEqual(assignment.type, 'Statement')
    assert.strictEqual(assignment.values[0].type, 'Pattern')
    assert.strictEqual(assignment.values[0].children[1]?.range.filePath, 'track.cadence')
  })

  it('should parse instrument routing expressions', () => {
    const result = parse(lexSource('& drums << my_pattern'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Statement',
        emit: true,
        expose: false,
        values: [
          {
            type: 'Routing',
            source: { type: 'Identifier', name: 'my_pattern' },
            destination: { type: 'Identifier', name: 'drums' }
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
          type: 'Statement',
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
        type: 'Statement',
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
                parameters: [
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
                parameters: [
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
        type: 'Statement',
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
                parameters: [],
                length: {
                  type: 'PropertyAccess',
                  object: { type: 'Number', value: 1 },
                  property: { type: 'Identifier', name: 'bar' }
                }
              },
              {
                type: 'CurveSegment',
                curveType: 'hold',
                parameters: [],
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
          type: 'Statement',
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
        type: 'Statement',
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
              { type: 'Identifier', name: 'arg1' },
              { type: 'Identifier', name: 'arg2' }
            ]
          }
        ]
      }
    ])
  })

  it('should parse mixer buses', () => {
    const source = [
      '& mixer {',
      '  & bus mybus(gain: (-3).db) {',
      '    & kick, snare, hihat',
      '    & fx.pan(0.5)',
      '    & @lp = fx.lowpass(400.hz)',
      '  }',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.strictEqual(result.value.children.length, 1)
    assert.strictEqual(result.value.children[0].type, 'Statement')

    const emissions = result.value.children[0].values

    assert.deepStrictEqual(stripRanges(emissions), [
      {
        type: 'Mixer',
        properties: [],
        children: [
          {
            type: 'Statement',
            emit: true,
            expose: false,
            values: [
              {
                type: 'Bus',
                name: { type: 'Identifier', name: 'mybus' },
                properties: [
                  {
                    type: 'Property',
                    key: { type: 'Identifier', name: 'gain' },
                    value: {
                      type: 'PropertyAccess',
                      object: { type: 'Number', value: -3 },
                      property: { type: 'Identifier', name: 'db' }
                    }
                  }
                ],
                children: [
                  {
                    type: 'Statement',
                    emit: true,
                    expose: false,
                    values: [
                      { type: 'Identifier', name: 'kick' },
                      { type: 'Identifier', name: 'snare' },
                      { type: 'Identifier', name: 'hihat' }
                    ]
                  },
                  {
                    type: 'Statement',
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
                          { type: 'Number', value: 0.5 }
                        ]
                      }
                    ]
                  },
                  {
                    type: 'Statement',
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
                            type: 'PropertyAccess',
                            object: { type: 'Number', value: 400 },
                            property: { type: 'Identifier', name: 'hz' }
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

  it('should allow named and unnamed parts', () => {
    const source = [
      '& track {',
      '  & part (4.bars) {}',
      '  & part my_part (2.bars) {}',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.strictEqual(result.value.children[0].type, 'Statement')
    assert.strictEqual(result.value.children[0].emit, true)

    const emissions = result.value.children[0].values

    assert.deepStrictEqual(stripRanges(emissions), [
      {
        type: 'Track',
        properties: [],
        children: [
          {
            type: 'Statement',
            emit: true,
            expose: false,
            values: [
              {
                type: 'Part',
                name: undefined,
                properties: [
                  {
                    type: 'PropertyAccess',
                    object: { type: 'Number', value: 4 },
                    property: { type: 'Identifier', name: 'bars' }
                  }
                ],
                children: []
              }
            ]
          },
          {
            type: 'Statement',
            emit: true,
            expose: false,
            values: [
              {
                type: 'Part',
                name: { type: 'Identifier', name: 'my_part' },
                properties: [
                  {
                    type: 'PropertyAccess',
                    object: { type: 'Number', value: 2 },
                    property: { type: 'Identifier', name: 'bars' }
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

  it('should allow named and unnamed buses', () => {
    const source = [
      '& mixer {',
      '  & bus (gain: (-3).db) {}',
      '  & bus my_bus(gain: (-6).db) {}',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.strictEqual(result.value.children[0].type, 'Statement')
    assert.strictEqual(result.value.children[0].emit, true)

    const emissions = result.value.children[0].values

    assert.deepStrictEqual(stripRanges(emissions), [
      {
        type: 'Mixer',
        properties: [],
        children: [
          {
            type: 'Statement',
            emit: true,
            expose: false,
            values: [
              {
                type: 'Bus',
                name: undefined,
                properties: [
                  {
                    type: 'Property',
                    key: { type: 'Identifier', name: 'gain' },
                    value: {
                      type: 'PropertyAccess',
                      object: { type: 'Number', value: -3 },
                      property: { type: 'Identifier', name: 'db' }
                    }
                  }
                ],
                children: []
              }
            ]
          },
          {
            type: 'Statement',
            emit: true,
            expose: false,
            values: [
              {
                type: 'Bus',
                name: { type: 'Identifier', name: 'my_bus' },
                properties: [
                  {
                    type: 'Property',
                    key: { type: 'Identifier', name: 'gain' },
                    value: {
                      type: 'PropertyAccess',
                      object: { type: 'Number', value: -6 },
                      property: { type: 'Identifier', name: 'db' }
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
        type: 'Statement',
        emit: true,
        expose: false,
        values: [
          {
            type: 'Track',
            properties: [],
            children: [
              {
                type: 'Statement',
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
        type: 'Statement',
        emit: true,
        expose: false,
        values: [
          {
            type: 'Mixer',
            properties: [],
            children: [
              {
                type: 'Statement',
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
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Statement',
        emit: false,
        expose: false,
        name: { type: 'Identifier', name: 'my_synth' },
        values: [
          {
            type: 'Instrument',
            children: [
              {
                type: 'Statement',
                emit: false,
                expose: false,
                name: { type: 'Identifier', name: 'foo' },
                values: [
                  {
                    type: 'UnaryExpression',
                    operator: '-',
                    argument: {
                      type: 'PropertyAccess',
                      object: { type: 'Number', value: 6 },
                      property: { type: 'Identifier', name: 'db' }
                    }
                  }
                ]
              },
              {
                type: 'Statement',
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
                        type: 'Statement',
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
                type: 'Statement',
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
      }
    ])
  })
})
