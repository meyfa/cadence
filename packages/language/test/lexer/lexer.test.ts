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
})
