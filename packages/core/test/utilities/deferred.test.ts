import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createDeferred } from '../../src/utilities/deferred.js'

describe('utilities/deferred.ts', () => {
  describe('createDeferred', () => {
    it('should create a deferred object with a promise, resolve, and reject', () => {
      const deferred = createDeferred<number>()

      assert.strictEqual(deferred.promise instanceof Promise, true)
      assert.strictEqual(typeof deferred.resolve, 'function')
      assert.strictEqual(typeof deferred.reject, 'function')
    })

    it('should resolve the promise when resolve is called', async () => {
      const deferred = createDeferred<string>()
      const testValue = 'Hello, Deferred!'

      const promiseResult = deferred.promise.then((value) => {
        return value
      })

      deferred.resolve(testValue)

      const result = await promiseResult
      assert.strictEqual(result, testValue)
    })

    it('should reject the promise when reject is called', async () => {
      const deferred = createDeferred()
      const testError = new Error('Deferred Rejection')

      const promiseResult = deferred.promise.catch((error: unknown) => {
        return error
      })

      deferred.reject(testError)

      const result = await promiseResult
      assert.strictEqual(result, testError)
    })
  })
})
