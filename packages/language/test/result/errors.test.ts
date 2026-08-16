import { describe, it } from 'node:test'
import assert from 'node:assert'
import { RangeError, CompoundError } from '../../src/result/errors.ts'
import type { SourceRange } from '@meyfa/cadence-ast'

describe('result/errors.ts', () => {
  describe('CompoundError', () => {
    it('should set the name property to "CompoundError"', () => {
      const error = new CompoundError('Test error', [])
      assert.strictEqual(error.name, 'CompoundError')
    })

    it('should set the message property', () => {
      const error = new CompoundError('Test error', [])
      assert.strictEqual(error.message, 'Test error')
    })

    it('should set the errors property', () => {
      const errors = [new Error('Error 1'), new Error('Error 2')]
      const compoundError = new CompoundError('Test error', errors)
      assert.deepStrictEqual(compoundError.errors, errors)
    })

    it('should JSON.stringify including name, message, and errors properties', () => {
      const name = 'CompoundError'
      const message = 'This is a test'
      const errors = [new Error('Error 1'), new Error('Error 2')]

      const compoundError = new CompoundError(message, errors)

      const expected = JSON.stringify({ name, message, errors })
      assert.strictEqual(JSON.stringify(compoundError), expected)
    })
  })

  describe('RangeError', () => {
    // RangeError is an abstract class.
    // eslint-disable-next-line unicorn/custom-error-definition
    class TestRangeError extends RangeError {
    }

    it('should set the name property to "RangeError"', () => {
      const error = new TestRangeError('Test error')
      assert.strictEqual(error.name, 'RangeError')
    })

    it('should set the message property', () => {
      const error = new TestRangeError('Test error')
      assert.strictEqual(error.message, 'Test error')
    })

    it('should set the range property when provided', () => {
      const range: SourceRange = {
        offset: 0,
        length: 10,
        line: 1,
        column: 1
      }

      const error = new TestRangeError('Test error', range)
      assert.deepStrictEqual(error.range, range)

      const errorWithoutRange = new TestRangeError('Test error')
      assert.strictEqual(errorWithoutRange.range, undefined)
    })

    it('should JSON.stringify including name, message, and range properties', () => {
      const name = 'RangeError'
      const message = 'This is a test'
      const range: SourceRange = {
        offset: 0,
        length: 10,
        line: 1,
        column: 1
      }

      const error = new TestRangeError(message, range)

      const expected = JSON.stringify({ name, message, range })
      assert.strictEqual(JSON.stringify(error), expected)
    })

    it('should JSON.stringify using the overridden name property', () => {
      const name = 'CustomTestRangeError'
      const message = 'This is a test'

      const error = new TestRangeError(message)
      error.name = name

      const expected = JSON.stringify({ name, message })
      assert.strictEqual(JSON.stringify(error), expected)
    })
  })
})
