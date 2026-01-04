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

  it('should lex patterns', () => {
    const result1 = lex('[x-x- --x-]')
    assert.deepStrictEqual(result1, {
      complete: true,
      value: [
        { name: '[', text: '[', offset: 0, len: 1, line: 1, column: 1, state: '' },

        { name: 'step', text: 'x', offset: 1, len: 1, line: 1, column: 2, state: 'pattern' },
        { name: 'step', text: '-', offset: 2, len: 1, line: 1, column: 3, state: 'pattern' },
        { name: 'step', text: 'x', offset: 3, len: 1, line: 1, column: 4, state: 'pattern' },
        { name: 'step', text: '-', offset: 4, len: 1, line: 1, column: 5, state: 'pattern' },

        { name: 'step', text: '-', offset: 6, len: 1, line: 1, column: 7, state: 'pattern' },
        { name: 'step', text: '-', offset: 7, len: 1, line: 1, column: 8, state: 'pattern' },
        { name: 'step', text: 'x', offset: 8, len: 1, line: 1, column: 9, state: 'pattern' },
        { name: 'step', text: '-', offset: 9, len: 1, line: 1, column: 10, state: 'pattern' },

        { name: ']', text: ']', offset: 10, len: 1, line: 1, column: 11, state: 'pattern' }
      ]
    })

    const result2 = lex('[C4 - E4 :0.5 - G4:1.0 - : 1 ]')
    assert.deepStrictEqual(result2, {
      complete: true,
      value: [
        { name: '[', text: '[', offset: 0, len: 1, line: 1, column: 1, state: '' },

        { name: 'step', text: 'C4', offset: 1, len: 2, line: 1, column: 2, state: 'pattern' },
        { name: 'step', text: '-', offset: 4, len: 1, line: 1, column: 5, state: 'pattern' },
        { name: 'step', text: 'E4', offset: 6, len: 2, line: 1, column: 7, state: 'pattern' },
        { name: ':', text: ':', offset: 9, len: 1, line: 1, column: 10, state: 'pattern' },
        { name: 'number', text: '0.5', offset: 10, len: 3, line: 1, column: 11, state: 'pattern' },

        { name: 'step', text: '-', offset: 14, len: 1, line: 1, column: 15, state: 'pattern' },
        { name: 'step', text: 'G4', offset: 16, len: 2, line: 1, column: 17, state: 'pattern' },
        { name: ':', text: ':', offset: 18, len: 1, line: 1, column: 19, state: 'pattern' },
        { name: 'number', text: '1.0', offset: 19, len: 3, line: 1, column: 20, state: 'pattern' },

        { name: 'step', text: '-', offset: 23, len: 1, line: 1, column: 24, state: 'pattern' },
        { name: ':', text: ':', offset: 25, len: 1, line: 1, column: 26, state: 'pattern' },
        { name: 'number', text: '1', offset: 27, len: 1, line: 1, column: 28, state: 'pattern' },

        { name: ']', text: ']', offset: 29, len: 1, line: 1, column: 30, state: 'pattern' }
      ]
    })
  })
})
