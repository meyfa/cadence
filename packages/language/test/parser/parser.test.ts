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
      { name: 'string', text: '"mylib"' },
      { name: 'word', text: 'as' },
      { name: 'word', text: 'myalias' },
      { name: 'word', text: 'use' },
      { name: 'string', text: '"otherlib"' },
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
              value: 'mylib'
            },
            alias: 'myalias'
          },
          {
            type: 'UseStatement',
            library: {
              type: 'String',
              value: 'otherlib'
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
      { name: 'string', text: '"mylib"' },
      { name: 'word', text: 'as' },
      { name: 'myalias' }
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
})
