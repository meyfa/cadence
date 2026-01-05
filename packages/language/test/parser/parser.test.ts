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
        children: []
      }
    })
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
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'foo' },
            value: { type: 'NumberLiteral', value: 42, unit: undefined }
          }
        ]
      }
    })
  })

  it('should parse a pattern', () => {
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
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'foo' },
            value: {
              type: 'Pattern',
              steps: [
                { type: 'Step', value: 'x' },
                { type: 'Step', value: 'x' },
                { type: 'Step', value: '-' },
                {
                  type: 'Step',
                  value: 'D4',
                  length: { type: 'NumberLiteral', value: 0.5, unit: undefined }
                },
                { type: 'Step', value: '-' },
                { type: 'Step', value: 'G4' }
              ]
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
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'pattern' },
            value: {
              type: 'Pattern',
              steps: [
                {
                  type: 'Step',
                  value: 'C4',
                  gate: { type: 'NumberLiteral', value: 2.0, unit: undefined }
                },
                { type: 'Step', value: '-' }
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
        children: [
          {
            type: 'Assignment',
            key: { type: 'Identifier', name: 'pattern' },
            value: {
              type: 'Pattern',
              steps: [
                {
                  type: 'Step',
                  value: 'C4',
                  gate: { type: 'NumberLiteral', value: 2.0, unit: undefined },
                  length: { type: 'NumberLiteral', value: 1.5, unit: undefined }
                },
                { type: 'Step', value: '-' }
              ]
            }
          }
        ]
      }
    })
  })
})
