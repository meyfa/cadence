import assert from 'node:assert'
import { describe, it } from 'node:test'
import { parseStringLiteral } from '../../src/parser/string.ts'

describe('parser/string.ts', () => {
  describe('parseStringLiteral()', () => {
    it('should parse plain string literals', () => {
      assert.strictEqual(parseStringLiteral('""'), '')
      assert.strictEqual(parseStringLiteral('"hello world"'), 'hello world')
      assert.strictEqual(parseStringLiteral('"Newline\nin string"'), 'Newline\nin string')
      assert.strictEqual(parseStringLiteral('"Tab\tseparated"'), 'Tab\tseparated')
    })

    it('should parse string literals with escapes', () => {
      assert.strictEqual(parseStringLiteral('"\\n"'), '\n')
      assert.strictEqual(parseStringLiteral('"Line 1\\nLine 2"'), 'Line 1\nLine 2')
      assert.strictEqual(parseStringLiteral('"Tab\\tSeparated"'), 'Tab\tSeparated')
      assert.strictEqual(parseStringLiteral('"Quote: \\""'), 'Quote: "')
      assert.strictEqual(parseStringLiteral('"Braces: \\{\\}"'), 'Braces: {}')
      assert.strictEqual(parseStringLiteral('"Backslash: \\\\"'), 'Backslash: \\')
    })

    it('should return undefined for invalid string literals', () => {
      assert.strictEqual(parseStringLiteral(''), undefined)
      assert.strictEqual(parseStringLiteral('"'), undefined)
      assert.strictEqual(parseStringLiteral('hello'), undefined)
      assert.strictEqual(parseStringLiteral('"Unclosed string'), undefined)
      assert.strictEqual(parseStringLiteral('Unopened string"'), undefined)
    })

    it('should return undefined when the input contains interpolation syntax', () => {
      assert.strictEqual(parseStringLiteral('"Hello {name}"'), undefined)
      assert.strictEqual(parseStringLiteral('"Hello {name"'), undefined)
      assert.strictEqual(parseStringLiteral('"Hello \\\\{name}"'), undefined)
      assert.strictEqual(parseStringLiteral('"{"'), undefined)
      assert.strictEqual(parseStringLiteral('"{}"'), undefined)
      assert.strictEqual(parseStringLiteral('"{"foo"}"'), undefined)
    })

    it('should ignore whitespace before and after the string literal', () => {
      assert.strictEqual(parseStringLiteral('   "hello"   '), 'hello')
      assert.strictEqual(parseStringLiteral('\n\t"world"\t\n'), 'world')
    })

    it('should keep whitespace inside the string literal', () => {
      assert.strictEqual(parseStringLiteral('"   leading and trailing   "'), '   leading and trailing   ')
      assert.strictEqual(parseStringLiteral('"   multiple   spaces   "'), '   multiple   spaces   ')
      assert.strictEqual(parseStringLiteral('"\nnewlines\nand\ttabs\t"'), '\nnewlines\nand\ttabs\t')
    })
  })
})
