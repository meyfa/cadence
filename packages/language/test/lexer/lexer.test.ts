import type { Result } from '@language/error.js'
import type { LexError } from '@language/lexer/error.js'
import type { Token } from 'leac'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { lex, type LexResult } from '../../src/lexer/lexer.js'

type LexResultWithoutMeta = Result<ReadonlyArray<Omit<Token, 'state' | 'offset' | 'len' | 'line' | 'column'>>, LexError>

/**
 * Helper function to strip metadata such as the source range from tokens for easier comparison in tests.
 */
function stripTokenMeta (result: LexResult): LexResultWithoutMeta {
  // Testing that the lexer library produces correct ranges is out of scope.

  if (!result.complete) {
    return result
  }

  return {
    complete: true,
    value: result.value.map(({ name, text }) => ({ name, text }))
  }
}

describe('lexer/lexer.ts', () => {
  it('should accept empty input', () => {
    const result = lex('')
    assert.deepStrictEqual(stripTokenMeta(result), { complete: true, value: [] })
  })

  it('should lex a simple input', () => {
    const result = lex('foo = 42')
    assert.deepStrictEqual(stripTokenMeta(result), {
      complete: true,
      value: [
        { name: 'word', text: 'foo' },
        { name: '=', text: '=' },
        { name: 'number', text: '42' }
      ]
    })
  })

  it('should lex identifiers', () => {
    const result = lex('x_#1 yVar _anotherVar')
    assert.deepStrictEqual(stripTokenMeta(result), {
      complete: true,
      value: [
        { name: 'word', text: 'x_#1' },
        { name: 'word', text: 'yVar' },
        { name: 'word', text: '_anotherVar' }
      ]
    })
  })

  it('should lex string literals', () => {
    const result = lex('"hello world" "" "string with escaped \\"quotes\\", \\\\ backslashes, and \\{braces}"')
    assert.deepStrictEqual(stripTokenMeta(result), {
      complete: true,
      value: [
        { name: '"', text: '"' },
        { name: 'stringContent', text: 'hello world' },
        { name: '"', text: '"' },
        { name: '"', text: '"' },
        { name: '"', text: '"' },
        { name: '"', text: '"' },
        { name: 'stringContent', text: 'string with escaped ' },
        { name: 'stringEscape', text: '\\"' },
        { name: 'stringContent', text: 'quotes' },
        { name: 'stringEscape', text: '\\"' },
        { name: 'stringContent', text: ', ' },
        { name: 'stringEscape', text: '\\\\' },
        { name: 'stringContent', text: ' backslashes, and ' },
        { name: 'stringEscape', text: '\\{' },
        { name: 'stringContent', text: 'braces}' },
        { name: '"', text: '"' }
      ]
    })
  })

  it('should lex string literals with interpolations', () => {
    const result = lex('"value is {x + 1}" "multiple {a} and {b * 2} interpolations"')
    assert.deepStrictEqual(stripTokenMeta(result), {
      complete: true,
      value: [
        { name: '"', text: '"' },
        { name: 'stringContent', text: 'value is ' },
        { name: '{', text: '{' },
        { name: 'word', text: 'x' },
        { name: '+', text: '+' },
        { name: 'number', text: '1' },
        { name: '}', text: '}' },
        { name: '"', text: '"' },
        { name: '"', text: '"' },
        { name: 'stringContent', text: 'multiple ' },
        { name: '{', text: '{' },
        { name: 'word', text: 'a' },
        { name: '}', text: '}' },
        { name: 'stringContent', text: ' and ' },
        { name: '{', text: '{' },
        { name: 'word', text: 'b' },
        { name: '*', text: '*' },
        { name: 'number', text: '2' },
        { name: '}', text: '}' },
        { name: 'stringContent', text: ' interpolations' },
        { name: '"', text: '"' }
      ]
    })
  })

  it('should handle invalid input', () => {
    const result = lex('foo = 42 $')
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.name, 'LexError')
    assert.strictEqual(result.error.message, 'Unexpected input "$"')
    assert.deepStrictEqual(result.error.range, { offset: 9, length: 1, line: 1, column: 10 })
  })

  it('should ignore whitespace and comments', () => {
    const result = lex(`foo //first comment\n// second comment\n  = 42`)
    assert.deepStrictEqual(stripTokenMeta(result), {
      complete: true,
      value: [
        { name: 'word', text: 'foo' },
        { name: '=', text: '=' },
        { name: 'number', text: '42' }
      ]
    })
  })

  it('should lex use statements', () => {
    const result = lex('use "effects" as fx\nuse "patterns" as *')
    assert.deepStrictEqual(stripTokenMeta(result), {
      complete: true,
      value: [
        { name: 'word', text: 'use' },
        { name: '"', text: '"' },
        { name: 'stringContent', text: 'effects' },
        { name: '"', text: '"' },
        { name: 'word', text: 'as' },
        { name: 'word', text: 'fx' },
        { name: 'word', text: 'use' },
        { name: '"', text: '"' },
        { name: 'stringContent', text: 'patterns' },
        { name: '"', text: '"' },
        { name: 'word', text: 'as' },
        { name: '*', text: '*' }
      ]
    })
  })

  it('should lex simple patterns', () => {
    const result = lex('[x-x- --xx]')
    assert.deepStrictEqual(stripTokenMeta(result), {
      complete: true,
      value: [
        { name: '[', text: '[' },

        { name: 'word', text: 'x' },
        { name: '-', text: '-' },
        { name: 'word', text: 'x' },
        { name: '-', text: '-' },

        { name: '-', text: '-' },
        { name: '-', text: '-' },
        { name: 'word', text: 'xx' },

        { name: ']', text: ']' }
      ]
    })
  })

  it('should lex complex patterns', () => {
    const result = lex('[C4 -- E4 :0.5 Eb4G#4:1.0 - : 1 ]')
    assert.deepStrictEqual(stripTokenMeta(result), {
      complete: true,
      value: [
        { name: '[', text: '[' },

        { name: 'word', text: 'C4' },
        { name: '-', text: '-' },
        { name: '-', text: '-' },
        { name: 'word', text: 'E4' },
        { name: ':', text: ':' },
        { name: 'number', text: '0.5' },

        { name: 'word', text: 'Eb4G#4' },
        { name: ':', text: ':' },
        { name: 'number', text: '1.0' },

        { name: '-', text: '-' },
        { name: ':', text: ':' },
        { name: 'number', text: '1' },

        { name: ']', text: ']' }
      ]
    })
  })

  it('should lex patterns with expressions', () => {
    const result = lex('[x:(foo([x:bar])+1.0) -:(baz)]')
    assert.deepStrictEqual(stripTokenMeta(result), {
      complete: true,
      value: [
        { name: '[', text: '[' },

        { name: 'word', text: 'x' },
        { name: ':', text: ':' },
        { name: '(', text: '(' },
        { name: 'word', text: 'foo' },
        { name: '(', text: '(' },
        { name: '[', text: '[' },

        { name: 'word', text: 'x' },
        { name: ':', text: ':' },
        { name: 'word', text: 'bar' },

        { name: ']', text: ']' },
        { name: ')', text: ')' },
        { name: '+', text: '+' },
        { name: 'number', text: '1.0' },
        { name: ')', text: ')' },

        { name: '-', text: '-' },
        { name: ':', text: ':' },
        { name: '(', text: '(' },
        { name: 'word', text: 'baz' },
        { name: ')', text: ')' },

        { name: ']', text: ']' }
      ]
    })
  })
})
