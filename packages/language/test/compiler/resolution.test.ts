import assert from 'node:assert'
import { describe, it } from 'node:test'
import { resolveInScope } from '../../src/compiler/resolution.ts'

describe('compiler/resolution.ts', () => {
  describe('resolveInScope()', () => {
    it('should resolve recursively', () => {
      const globalFoo = 'globalFoo'

      const localBar = 'localBar'

      const globalBaz = 'globalBaz'
      const localBaz = 'localBaz'

      const globalScope = {
        resolutions: new Map([
          ['foo', globalFoo],
          ['baz', globalBaz]
        ])
      }

      const localScope = {
        parent: globalScope,
        resolutions: new Map([
          ['bar', localBar],
          ['baz', localBaz]
        ])
      }

      const nestedLocalScope = {
        parent: localScope,
        resolutions: new Map()
      }

      assert.strictEqual(resolveInScope(localScope, 'foo'), globalFoo)
      assert.strictEqual(resolveInScope(localScope, 'bar'), localBar)
      assert.strictEqual(resolveInScope(localScope, 'baz'), localBaz)

      assert.strictEqual(resolveInScope(nestedLocalScope, 'foo'), globalFoo)
      assert.strictEqual(resolveInScope(nestedLocalScope, 'bar'), localBar)
      assert.strictEqual(resolveInScope(nestedLocalScope, 'baz'), localBaz)

      assert.strictEqual(resolveInScope(globalScope, 'foo'), globalFoo)
      assert.strictEqual(resolveInScope(globalScope, 'bar'), undefined)
      assert.strictEqual(resolveInScope(globalScope, 'baz'), globalBaz)
    })
  })
})
