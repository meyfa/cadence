import type { Token } from 'leac'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { lex } from '../../src/lexer/lexer.js'
import { parse } from '../../src/parser/parser.js'
import { assertResultComplete } from '../test-utils.js'

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

  it('should parse use statements', () => {
    const source = [
      'use "mylib" as myalias',
      'use "otherlib" as *'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.imports), [
      {
        type: 'UseStatement',
        library: {
          type: 'String',
          parts: ['mylib']
        },
        alias: 'myalias'
      },
      {
        type: 'UseStatement',
        library: {
          type: 'String',
          parts: ['otherlib']
        }
      }
    ])
  })

  it('should reject use statements after other statements', () => {
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
        type: 'Assignment',
        key: { type: 'Identifier', name: 'foo' },
        value: { type: 'Number', value: 42 }
      }
    ])
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
        type: 'Assignment',
        key: { type: 'Identifier', name: 'offset' },
        value: {
          type: 'UnaryExpression',
          operator: '-',
          argument: {
            type: 'PropertyAccess',
            object: { type: 'Number', value: 1.5 },
            property: { type: 'Identifier', name: 'ms' }
          }
        }
      },
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'gain' },
        value: {
          type: 'PropertyAccess',
          object: {
            type: 'BinaryExpression',
            operator: '+',
            left: { type: 'Number', value: -6 },
            right: { type: 'Number', value: 3 }
          },
          property: { type: 'Identifier', name: 'db' }
        }
      }
    ])
  })

  it('should parse explicit bus parameter access', () => {
    const result = parse(lexSource('target = bus.main.gain'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'target' },
        value: {
          type: 'PropertyAccess',
          object: {
            type: 'PropertyAccess',
            object: { type: 'Identifier', name: 'bus' },
            property: { type: 'Identifier', name: 'main' }
          },
          property: { type: 'Identifier', name: 'gain' }
        }
      }
    ])
  })

  it('should parse string literals with escapes and interpolations', () => {
    const result = parse(lexSource('foo = "a \\{ b {x} c"'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'foo' },
        value: {
          type: 'String',
          parts: [
            'a { b ',
            { type: 'Identifier', name: 'x' },
            ' c'
          ]
        }
      }
    ])
  })

  it('should parse a serial pattern', () => {
    const result = parse(lexSource('foo = [xx-D4:0.5-G4]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'foo' },
        value: {
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
      }
    ])
  })

  it('should parse an empty serial pattern', () => {
    const result = parse(lexSource('foo = []'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'foo' },
        value: {
          type: 'Pattern',
          mode: 'serial',
          children: []
        }
      }
    ])
  })

  it('should parse a pattern with gate', () => {
    const result = parse(lexSource('pattern = [C4(2.0)-]'))
    assertResultComplete(result)

    const gate = { type: 'Number', value: 2.0 }

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'pattern' },
        value: {
          type: 'Pattern',
          mode: 'serial',
          children: [
            { type: 'Step', value: 'C4', parameters: [gate] },
            { type: 'Step', value: '-', parameters: [] }
          ]
        }
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
        type: 'Assignment',
        key: { type: 'Identifier', name: 'pattern' },
        value: {
          type: 'Pattern',
          mode: 'serial',
          children: [
            { type: 'Step', value: 'C4', length, parameters: [gate] },
            { type: 'Step', value: '-', parameters: [] }
          ]
        }
      }
    ])
  })

  it('should parse a pattern with named arguments', () => {
    const result = parse(lexSource('pattern = [C4(gate: 2.0):1.5-]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'pattern' },
        value: {
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
      }
    ])
  })

  it('should parse a pattern with parallel steps', () => {
    const result = parse(lexSource('pattern = [<C4:0.75-:0.25>E4]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'pattern' },
        value: {
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
        type: 'Assignment',
        key: { type: 'Identifier', name: 'pattern' },
        value: {
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
      }
    ])
  })

  it('should preserve file paths in split pattern step ranges', () => {
    const result = parse(lexSource('pattern = [xx:1]', 'track.cadence'))
    assertResultComplete(result)

    const assignment = result.value.children[0]
    assert.strictEqual(assignment.type, 'Assignment')
    assert.strictEqual(assignment.value.type, 'Pattern')
    assert.strictEqual(assignment.value.children[1]?.range.filePath, 'track.cadence')
  })

  it('should parse property access expressions', () => {
    const nonParenthesized = 'x = object.foo.bar'

    const parenthesized = 'x = (object.foo).bar'

    for (const source of [nonParenthesized, parenthesized]) {
      const result = parse(lexSource(source))
      assertResultComplete(result)

      assert.deepStrictEqual(stripRanges(result.value.children), [
        {
          type: 'Assignment',
          key: { type: 'Identifier', name: 'x' },
          value: {
            type: 'PropertyAccess',
            object: {
              type: 'PropertyAccess',
              object: { type: 'Identifier', name: 'object' },
              property: { type: 'Identifier', name: 'foo' }
            },
            property: { type: 'Identifier', name: 'bar' }
          }
        }
      ])
    }
  })

  it('should parse curve expressions', () => {
    const result = parse(lexSource('foo = ~[hold(0) lin(0, 1)]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'foo' },
        value: {
          type: 'Curve',
          children: [
            {
              type: 'CurveSegment',
              curveType: 'hold',
              parameters: [
                { type: 'Number', value: 0 }
              ]
            },
            {
              type: 'CurveSegment',
              curveType: 'lin',
              parameters: [
                { type: 'Number', value: 0 },
                { type: 'Number', value: 1 }
              ]
            }
          ]
        }
      }
    ])
  })

  it('should parse curve segment lengths', () => {
    const result = parse(lexSource('foo = ~[hold(0):3 lin(0, 1):1]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'foo' },
        value: {
          type: 'Curve',
          children: [
            {
              type: 'CurveSegment',
              curveType: 'hold',
              parameters: [
                { type: 'Number', value: 0 }
              ],
              length: { type: 'Number', value: 3 }
            },
            {
              type: 'CurveSegment',
              curveType: 'lin',
              parameters: [
                { type: 'Number', value: 0 },
                { type: 'Number', value: 1 }
              ],
              length: { type: 'Number', value: 1 }
            }
          ]
        }
      }
    ])
  })

  it('should parse curve segments without parameters', () => {
    const result = parse(lexSource('foo = ~[hold hold:2]'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'foo' },
        value: {
          type: 'Curve',
          children: [
            {
              type: 'CurveSegment',
              curveType: 'hold',
              parameters: []
            },
            {
              type: 'CurveSegment',
              curveType: 'hold',
              parameters: [],
              length: { type: 'Number', value: 2 }
            }
          ]
        }
      }
    ])
  })

  it('should parse property access with function calls', () => {
    const nonParenthesized = 'x = object.method1().method2()'
    const parenthesized = 'x = (object.method1()).method2()'

    for (const source of [nonParenthesized, parenthesized]) {
      const result = parse(lexSource(source))
      assertResultComplete(result)

      assert.deepStrictEqual(stripRanges(result.value.children), [
        {
          type: 'Assignment',
          key: { type: 'Identifier', name: 'x' },
          value: {
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
        }
      ])
    }
  })

  it('should parse calling the result of a call', () => {
    const result = parse(lexSource('x = factory()(arg1, arg2)'))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'x' },
        value: {
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
      }
    ])
  })

  it('should parse mixer buses', () => {
    const source = [
      'mixer {',
      '  bus mybus(gain: (-3).db) {',
      '    kick snare hihat',
      '    effect fx.pan(0.5)',
      '    effect lp = fx.lowpass(400.hz)',
      '  }',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'MixerStatement',
        properties: [],
        children: [
          {
            type: 'BusStatement',
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
            sources: [
              { type: 'Identifier', name: 'kick' },
              { type: 'Identifier', name: 'snare' },
              { type: 'Identifier', name: 'hihat' }
            ],
            effects: [
              {
                type: 'EffectStatement',
                name: undefined,
                expression: {
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
              },
              {
                type: 'EffectStatement',
                name: { type: 'Identifier', name: 'lp' },
                expression: {
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
              }
            ]
          }
        ]
      }
    ])
  })

  it('should allow unnamed parts', () => {
    const result = parse(lexSource('track { part (4.bars) {} }'))
    assert.strictEqual(result.complete, true)
    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'TrackStatement',
        properties: [],
        children: [
          {
            type: 'PartStatement',
            name: undefined,
            properties: [
              {
                type: 'PropertyAccess',
                object: { type: 'Number', value: 4 },
                property: { type: 'Identifier', name: 'bars' }
              }
            ],
            routings: [],
            automations: []
          }
        ]
      }
    ])
  })

  it('should reject unnamed buses', () => {
    const result = parse(lexSource('mixer { bus {} }'))
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.message, 'Unexpected "{"; expected bus name')
  })

  it('should allow assignments in track and mixer bodies', () => {
    const source = [
      'track {',
      '  foo = 42',
      '}',
      'mixer {',
      '  bar = 43',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'TrackStatement',
        properties: [],
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'foo' },
            value: { type: 'Number', value: 42 }
          }
        ]
      },
      {
        type: 'MixerStatement',
        properties: [],
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'bar' },
            value: { type: 'Number', value: 43 }
          }
        ]
      }
    ])
  })

  it('should parse instrument expressions', () => {
    const source = [
      'my_synth = instrument {',
      '  foo = -6.db',
      '}'
    ].join('\n')

    const result = parse(lexSource(source))
    assertResultComplete(result)

    assert.deepStrictEqual(stripRanges(result.value.children), [
      {
        type: 'Assignment',
        key: { type: 'Identifier', name: 'my_synth' },
        value: {
          type: 'Instrument',
          children: [
            {
              type: 'Assignment',
              key: { type: 'Identifier', name: 'foo' },
              value: {
                type: 'UnaryExpression',
                operator: '-',
                argument: {
                  type: 'PropertyAccess',
                  object: { type: 'Number', value: 6 },
                  property: { type: 'Identifier', name: 'db' }
                }
              }
            }
          ]
        }
      }
    ])
  })
})
