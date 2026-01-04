import assert from 'node:assert'
import { describe, it } from 'node:test'
import { lex } from '../../src/lexer/lexer.js'

describe('lexer/lexer.ts', () => {
  it('should accept empty input', () => {
    const result = lex('')
    assert.deepStrictEqual(result, { complete: true, value: [] })
  })

  it('should lex a simple input', () => {
    const result = lex('foo = 42')
    assert.deepStrictEqual(result, {
      complete: true,
      value: [
        { name: 'word', text: 'foo', offset: 0, len: 3, line: 1, column: 1, state: '' },
        { name: '=', text: '=', offset: 4, len: 1, line: 1, column: 5, state: '' },
        { name: 'number', text: '42', offset: 6, len: 2, line: 1, column: 7, state: '' }
      ]
    })
  })

  it('should lex identifiers', () => {
    const result = lex('x_#1 yVar _anotherVar')
    assert.deepStrictEqual(result, {
      complete: true,
      value: [
        { name: 'word', text: 'x_#1', offset: 0, len: 4, line: 1, column: 1, state: '' },
        { name: 'word', text: 'yVar', offset: 5, len: 4, line: 1, column: 6, state: '' },
        { name: 'word', text: '_anotherVar', offset: 10, len: 11, line: 1, column: 11, state: '' }
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
    assert.deepStrictEqual(result, {
      complete: true,
      value: [
        { name: 'word', text: 'foo', offset: 0, len: 3, line: 1, column: 1, state: '' },
        { name: '=', text: '=', offset: 40, len: 1, line: 3, column: 3, state: '' },
        { name: 'number', text: '42', offset: 42, len: 2, line: 3, column: 5, state: '' }
      ]
    })
  })

  it('should lex simple patterns', () => {
    const result = lex('[x-x- --xx]')
    assert.deepStrictEqual(result, {
      complete: true,
      value: [
        { name: '[', text: '[', offset: 0, len: 1, line: 1, column: 1, state: '' },

        { name: 'word', text: 'x', offset: 1, len: 1, line: 1, column: 2, state: '' },
        { name: '-', text: '-', offset: 2, len: 1, line: 1, column: 3, state: '' },
        { name: 'word', text: 'x', offset: 3, len: 1, line: 1, column: 4, state: '' },
        { name: '-', text: '-', offset: 4, len: 1, line: 1, column: 5, state: '' },

        { name: '-', text: '-', offset: 6, len: 1, line: 1, column: 7, state: '' },
        { name: '-', text: '-', offset: 7, len: 1, line: 1, column: 8, state: '' },
        { name: 'word', text: 'xx', offset: 8, len: 2, line: 1, column: 9, state: '' },

        { name: ']', text: ']', offset: 10, len: 1, line: 1, column: 11, state: '' }
      ]
    })
  })

  it('should lex complex patterns', () => {
    const result = lex('[C4 -- E4 :0.5 Eb4G#4:1.0 - : 1 ]')
    assert.deepStrictEqual(result, {
      complete: true,
      value: [
        { name: '[', text: '[', offset: 0, len: 1, line: 1, column: 1, state: '' },

        { name: 'word', text: 'C4', offset: 1, len: 2, line: 1, column: 2, state: '' },
        { name: '-', text: '-', offset: 4, len: 1, line: 1, column: 5, state: '' },
        { name: '-', text: '-', offset: 5, len: 1, line: 1, column: 6, state: '' },
        { name: 'word', text: 'E4', offset: 7, len: 2, line: 1, column: 8, state: '' },
        { name: ':', text: ':', offset: 10, len: 1, line: 1, column: 11, state: '' },
        { name: 'number', text: '0.5', offset: 11, len: 3, line: 1, column: 12, state: '' },

        { name: 'word', text: 'Eb4G#4', offset: 15, len: 6, line: 1, column: 16, state: '' },
        { name: ':', text: ':', offset: 21, len: 1, line: 1, column: 22, state: '' },
        { name: 'number', text: '1.0', offset: 22, len: 3, line: 1, column: 23, state: '' },

        { name: '-', text: '-', offset: 26, len: 1, line: 1, column: 27, state: '' },
        { name: ':', text: ':', offset: 28, len: 1, line: 1, column: 29, state: '' },
        { name: 'number', text: '1', offset: 30, len: 1, line: 1, column: 31, state: '' },

        { name: ']', text: ']', offset: 32, len: 1, line: 1, column: 33, state: '' }
      ]
    })
  })

  it('should lex patterns with expressions', () => {
    const result = lex('[x:foo([x:bar])+(1.0) -:(baz)]')
    assert.deepStrictEqual(result, {
      complete: true,
      value: [
        { name: '[', text: '[', offset: 0, len: 1, line: 1, column: 1, state: '' },

        { name: 'word', text: 'x', offset: 1, len: 1, line: 1, column: 2, state: '' },
        { name: ':', text: ':', offset: 2, len: 1, line: 1, column: 3, state: '' },
        { name: 'word', text: 'foo', offset: 3, len: 3, line: 1, column: 4, state: '' },
        { name: '(', text: '(', offset: 6, len: 1, line: 1, column: 7, state: '' },
        { name: '[', text: '[', offset: 7, len: 1, line: 1, column: 8, state: '' },

        { name: 'word', text: 'x', offset: 8, len: 1, line: 1, column: 9, state: '' },
        { name: ':', text: ':', offset: 9, len: 1, line: 1, column: 10, state: '' },
        { name: 'word', text: 'bar', offset: 10, len: 3, line: 1, column: 11, state: '' },

        { name: ']', text: ']', offset: 13, len: 1, line: 1, column: 14, state: '' },
        { name: ')', text: ')', offset: 14, len: 1, line: 1, column: 15, state: '' },
        { name: '+', text: '+', offset: 15, len: 1, line: 1, column: 16, state: '' },
        { name: '(', text: '(', offset: 16, len: 1, line: 1, column: 17, state: '' },
        { name: 'number', text: '1.0', offset: 17, len: 3, line: 1, column: 18, state: '' },
        { name: ')', text: ')', offset: 20, len: 1, line: 1, column: 21, state: '' },

        { name: '-', text: '-', offset: 22, len: 1, line: 1, column: 23, state: '' },
        { name: ':', text: ':', offset: 23, len: 1, line: 1, column: 24, state: '' },
        { name: '(', text: '(', offset: 24, len: 1, line: 1, column: 25, state: '' },
        { name: 'word', text: 'baz', offset: 25, len: 3, line: 1, column: 26, state: '' },
        { name: ')', text: ')', offset: 28, len: 1, line: 1, column: 29, state: '' },

        { name: ']', text: ']', offset: 29, len: 1, line: 1, column: 30, state: '' }
      ]
    })
  })
})
