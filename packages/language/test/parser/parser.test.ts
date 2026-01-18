import type { Token } from 'leac'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { parse } from '../../src/parser/parser.js'

/**
 * Helper function to create an array of tokens with automatically assigned source ranges
 */
function makeTokens (tokens: ReadonlyArray<Readonly<{ name: string, text?: string }>>): Token[] {
  let offset = 0

  return tokens.map(({ name, text }) => {
    const tokenText = text ?? name
    const token = {
      name,
      text: tokenText,
      offset,
      len: tokenText.length,
      line: 1,
      column: offset + 1,
      state: ''
    }

    offset += tokenText.length + 1 // +1 for space

    return token
  })
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
    const result = parse(makeTokens([]))
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
    const result = parse(makeTokens([
      { name: 'word', text: 'use' },
      { name: '"' },
      { name: 'stringContent', text: 'mylib' },
      { name: '"' },
      { name: 'word', text: 'as' },
      { name: 'word', text: 'myalias' },
      { name: 'word', text: 'use' },
      { name: '"' },
      { name: 'stringContent', text: 'otherlib' },
      { name: '"' },
      { name: 'word', text: 'as' },
      { name: '*' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [
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
        ],
        children: []
      }
    })
  })

  it('should reject use statements after other statements', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'foo' },
      { name: '=' },
      { name: 'number', text: '42' },
      { name: 'word', text: 'use' },
      { name: '"' },
      { name: 'stringContent', text: 'mylib' },
      { name: '"' },
      { name: 'word', text: 'as' },
      { name: 'word', text: 'myalias' }
    ]))
    assert.strictEqual(result.complete, false)
  })

  it('should parse a simple assignment', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'foo' },
      { name: '=' },
      { name: 'number', text: '42' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'foo' },
            value: { type: 'Number', value: 42, unit: undefined }
          }
        ]
      }
    })
  })

  it('should parse string literals with escapes and interpolations', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'foo' },
      { name: '=' },
      { name: '"' },
      { name: 'stringContent', text: 'a ' },
      { name: 'stringEscape', text: '\\{' },
      { name: 'stringContent', text: ' b ' },
      { name: '{' },
      { name: 'word', text: 'x' },
      { name: '}' },
      { name: 'stringContent', text: ' c' },
      { name: '"' }
    ]))

    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'foo' },
            value: {
              type: 'String',
              parts: ['a { b ', { type: 'Identifier', name: 'x' }, ' c']
            }
          }
        ]
      }
    })
  })

  it('should parse a serial pattern', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'foo' },
      { name: '=' },
      { name: '[' },
      { name: 'word', text: 'xx' },
      { name: '-' },
      { name: 'word', text: 'D4' },
      { name: ':' },
      { name: 'number', text: '0.5' },
      { name: '-' },
      { name: 'word', text: 'G4' },
      { name: ']' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
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
                {
                  type: 'Step',
                  value: 'D4',
                  length: { type: 'Number', value: 0.5, unit: undefined },
                  parameters: []
                },
                { type: 'Step', value: '-', parameters: [] },
                { type: 'Step', value: 'G4', parameters: [] }
              ]
            }
          }
        ]
      }
    })
  })

  it('should parse an empty serial pattern', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'foo' },
      { name: '=' },
      { name: '[' },
      { name: ']' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'foo' },
            value: {
              type: 'Pattern',
              mode: 'serial',
              children: []
            }
          }
        ]
      }
    })
  })

  it('should parse a pattern with gate', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'pattern' },
      { name: '=' },
      { name: '[' },
      { name: 'word', text: 'C4' },
      { name: '(' },
      { name: 'number', text: '2.0' },
      { name: ')' },
      { name: '-' },
      { name: ']' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
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
                  parameters: [
                    { type: 'Number', value: 2.0, unit: undefined }
                  ]
                },
                { type: 'Step', value: '-', parameters: [] }
              ]
            }
          }
        ]
      }
    })
  })

  it('should parse a pattern with gate and length', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'pattern' },
      { name: '=' },
      { name: '[' },
      { name: 'word', text: 'C4' },
      { name: '(' },
      { name: 'number', text: '2.0' },
      { name: ')' },
      { name: ':' },
      { name: 'number', text: '1.5' },
      { name: '-' },
      { name: ']' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
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
                  length: { type: 'Number', value: 1.5, unit: undefined },
                  parameters: [
                    { type: 'Number', value: 2.0, unit: undefined }
                  ]
                },
                { type: 'Step', value: '-', parameters: [] }
              ]
            }
          }
        ]
      }
    })
  })

  it('should parse a pattern with named arguments', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'pattern' },
      { name: '=' },
      { name: '[' },
      { name: 'word', text: 'C4' },
      { name: '(' },
      { name: 'word', text: 'gate' },
      { name: ':' },
      { name: 'number', text: '2.0' },
      { name: ')' },
      { name: ':' },
      { name: 'number', text: '1.5' },
      { name: '-' },
      { name: ']' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
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
                  length: {
                    type: 'Number',
                    value: 1.5,
                    unit: undefined
                  },
                  parameters: [
                    {
                      type: 'Property',
                      key: { type: 'Identifier', name: 'gate' },
                      value: { type: 'Number', value: 2.0, unit: undefined }
                    }
                  ]
                },
                { type: 'Step', value: '-', parameters: [] }
              ]
            }
          }
        ]
      }
    })
  })

  it('should parse a pattern with parallel steps', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'pattern' },
      { name: '=' },
      { name: '[' },
      { name: '<' },
      { name: 'word', text: 'C4' },
      { name: ':' },
      { name: 'number', text: '0.75' },
      { name: '-' },
      { name: ':' },
      { name: 'number', text: '0.25' },
      { name: '>' },
      { name: 'word', text: 'E4' },
      { name: ']' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
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
                      length: { type: 'Number', value: 0.75, unit: undefined },
                      parameters: []
                    },
                    {
                      type: 'Step',
                      value: '-',
                      length: { type: 'Number', value: 0.25, unit: undefined },
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
        ]
      }
    })
  })

  it('should reject empty parallel patterns', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'pattern' },
      { name: '=' },
      { name: '[' },
      { name: '<' },
      { name: '>' },
      { name: ']' }
    ]))
    assert.strictEqual(result.complete, false)
  })

  it('should parse patterns with interpolations', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'pattern' },
      { name: '=' },
      { name: '[' },
      { name: 'word', text: 'C4' },
      { name: '-' },
      { name: '{' },
      { name: 'word', text: 'some_pattern' },
      { name: '*' },
      { name: 'number', text: '2' },
      { name: '}' },
      { name: ']' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
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
                  right: { type: 'Number', value: 2, unit: undefined }
                }
              ]
            }
          }
        ]
      }
    })
  })

  it('should parse property access expressions', () => {
    // x = object.foo.bar
    const nonParenthesized = makeTokens([
      { name: 'word', text: 'x' },
      { name: '=' },
      { name: 'word', text: 'object' },
      { name: '.' },
      { name: 'word', text: 'foo' },
      { name: '.' },
      { name: 'word', text: 'bar' }
    ])

    // x = (object.foo).bar
    const parenthesized = makeTokens([
      { name: 'word', text: 'x' },
      { name: '=' },
      { name: '(' },
      { name: 'word', text: 'object' },
      { name: '.' },
      { name: 'word', text: 'foo' },
      { name: ')' },
      { name: '.' },
      { name: 'word', text: 'bar' }
    ])

    // both should produce the same AST
    for (const tokens of [nonParenthesized, parenthesized]) {
      const result = parse(tokens)
      assert.deepStrictEqual(stripRanges(result), {
        complete: true,
        value: {
          type: 'Program',
          imports: [],
          children: [
            {
              type: 'Assignment',
              key: { type: 'Identifier', name: 'x' },
              value: {
                type: 'PropertyAccess',
                object: {
                  type: 'PropertyAccess',
                  object: {
                    type: 'Identifier',
                    name: 'object'
                  },
                  property: {
                    type: 'Identifier',
                    name: 'foo'
                  }
                },
                property: {
                  type: 'Identifier',
                  name: 'bar'
                }
              }
            }
          ]
        }
      })
    }
  })

  it('should parse property access with function calls', () => {
    // x = object.method1().method2()
    const nonParenthesized = makeTokens([
      { name: 'word', text: 'x' },
      { name: '=' },
      { name: 'word', text: 'object' },
      { name: '.' },
      { name: 'word', text: 'method1' },
      { name: '(' },
      { name: ')' },
      { name: '.' },
      { name: 'word', text: 'method2' },
      { name: '(' },
      { name: ')' }
    ])

    // x = (object.method1()).method2()
    const parenthesized = makeTokens([
      { name: 'word', text: 'x' },
      { name: '=' },
      { name: '(' },
      { name: 'word', text: 'object' },
      { name: '.' },
      { name: 'word', text: 'method1' },
      { name: '(' },
      { name: ')' },
      { name: '.' },
      { name: 'word', text: 'method2' },
      { name: ')' },
      { name: '(' },
      { name: ')' }
    ])

    for (const tokens of [nonParenthesized, parenthesized]) {
      const result = parse(tokens)
      assert.deepStrictEqual(stripRanges(result), {
        complete: true,
        value: {
          type: 'Program',
          imports: [],
          children: [
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
                      object: {
                        type: 'Identifier',
                        name: 'object'
                      },
                      property: {
                        type: 'Identifier',
                        name: 'method1'
                      }
                    },
                    arguments: []
                  },
                  property: {
                    type: 'Identifier',
                    name: 'method2'
                  }
                },
                arguments: []
              }
            }
          ]
        }
      })
    }
  })

  it('should parse calling the result of a call', () => {
    // x = factory()(arg1, arg2)
    const result = parse(makeTokens([
      { name: 'word', text: 'x' },
      { name: '=' },
      { name: 'word', text: 'factory' },
      { name: '(' },
      { name: ')' },
      { name: '(' },
      { name: 'word', text: 'arg1' },
      { name: ',' },
      { name: 'word', text: 'arg2' },
      { name: ')' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'x' },
            value: {
              type: 'Call',
              callee: {
                type: 'Call',
                callee: {
                  type: 'Identifier',
                  name: 'factory'
                },
                arguments: []
              },
              arguments: [
                { type: 'Identifier', name: 'arg1' },
                { type: 'Identifier', name: 'arg2' }
              ]
            }
          }
        ]
      }
    })
  })

  it('should parse mixer buses', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'mixer' },
      { name: '{' },
      { name: 'word', text: 'bus' },
      { name: 'word', text: 'mybus' },
      { name: '(' },
      { name: 'word', text: 'gain' },
      { name: ':' },
      { name: 'number', text: '-3' },
      { name: 'word', text: 'db' },
      { name: ')' },
      { name: '{' },
      { name: 'word', text: 'kick' },
      { name: 'word', text: 'snare' },
      { name: 'word', text: 'hihat' },
      { name: 'word', text: 'effect' },
      { name: 'word', text: 'fx' },
      { name: '.' },
      { name: 'word', text: 'pan' },
      { name: '(' },
      { name: 'number', text: '0.5' },
      { name: ')' },
      { name: '}' },
      { name: '}' }
    ]))
    assert.deepStrictEqual(stripRanges(result), {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [
          {
            type: 'MixerStatement',
            properties: [],
            buses: [
              {
                type: 'BusStatement',
                name: { type: 'Identifier', name: 'mybus' },
                properties: [
                  {
                    type: 'Property',
                    key: { type: 'Identifier', name: 'gain' },
                    value: { type: 'Number', value: -3, unit: 'db' }
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
                    expression: {
                      type: 'Call',
                      callee: {
                        type: 'PropertyAccess',
                        object: { type: 'Identifier', name: 'fx' },
                        property: { type: 'Identifier', name: 'pan' }
                      },
                      arguments: [
                        { type: 'Number', value: 0.5, unit: undefined }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    })
  })

  it('should reject unnamed parts', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'track' },
      { name: '{' },
      { name: 'word', text: 'part' },
      { name: '(' },
      { name: 'number', text: '4' },
      { name: 'word', text: 'bars' },
      { name: ')' },
      { name: '{' },
      { name: '}' },
      { name: '}' }
    ]))
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.message, 'Unexpected "("; expected part name')
  })

  it('should reject unnamed buses', () => {
    const result = parse(makeTokens([
      { name: 'word', text: 'mixer' },
      { name: '{' },
      { name: 'word', text: 'bus' },
      { name: '{' },
      { name: '}' },
      { name: '}' }
    ]))
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.message, 'Unexpected "{"; expected bus name')
  })
})
