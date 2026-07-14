import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as compilerAssert from '../../src/compiler/assert.ts'
import { CompileError } from '../../src/compiler/error.ts'

describe('compiler/assert.ts', () => {
  describe('fail', () => {
    it('throws a CompileError with the default message', () => {
      const defaultMessage = 'Internal compiler error (should have been caught in semantic analysis)'
      assert.throws(() => {
        compilerAssert.fail()
      }, (error) => {
        return error instanceof CompileError && error.message === defaultMessage
      })
    })

    it('throws a CompileError with the provided message', () => {
      const message = 'Test error message'
      assert.throws(() => {
        compilerAssert.fail(message)
      }, (error) => {
        return error instanceof CompileError && error.message === message
      })
    })
  })

  describe('assert', () => {
    it('does not throw when the condition is true', () => {
      assert.doesNotThrow(() => {
        compilerAssert.assert(true)
      })
    })

    it('throws a CompileError when the condition is false', () => {
      const message = 'Condition failed'
      assert.throws(() => {
        compilerAssert.assert(false, message)
      }, (error) => {
        return error instanceof CompileError && error.message === message
      })
    })
  })

  describe('assertNever', () => {
    it('throws a CompileError', () => {
      const message = 'This should never happen'
      assert.throws(() => {
        compilerAssert.assertNever(undefined as never, message)
      }, (error) => {
        return error instanceof CompileError && error.message === message
      })
    })

    it('produces a TypeScript error when called with a non-never type', () => {
      assert.throws(() => {
        const foo = undefined
        // @ts-expect-error: This should produce a TypeScript error
        compilerAssert.assertNever(foo, 'This should never happen')
      })
    })
  })

  describe('nonNull', () => {
    it('returns the value when it is not null or undefined', () => {
      for (const value of [0, '', false, {}, []]) {
        const result = compilerAssert.nonNull(value)
        assert.strictEqual(result, value)
      }
    })

    it('throws a CompileError when the value is null or undefined', () => {
      const message = 'Value cannot be null or undefined'
      for (const value of [null, undefined]) {
        assert.throws(() => {
          compilerAssert.nonNull(value, message)
        }, (error) => {
          return error instanceof CompileError && error.message === message
        })
      }
    })
  })
})
