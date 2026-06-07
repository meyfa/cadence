import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createGlobalScope, createLocalScope, createNamespace } from '../../../src/compiler/checker/scopes.js'
import { NumberFacet } from '../../../src/type-system/base/number.js'

describe('compiler/checker/scopes.ts', () => {
  describe('createGlobalScope()', () => {
    it('should create a global scope with the provided initial resolutions', () => {
      const foo = NumberFacet.with('db').type()

      const result = createGlobalScope(new Map([['foo', foo]]))

      assert.strictEqual(result.top, result)
      assert.strictEqual(result.parent, undefined)

      assert.strictEqual(result.resolutions.get('foo'), foo)

      assert.strictEqual(result.buses.size, 0)
      assert.strictEqual(result.namespaces.size, 0)
    })
  })

  describe('createLocalScope()', () => {
    it('should create a local scope with the provided parent and empty resolutions', () => {
      const globalScope = createGlobalScope(new Map([
        ['foo', NumberFacet.with('db').type()]
      ]))

      const localScope = createLocalScope(globalScope)

      assert.strictEqual(localScope.top, globalScope)
      assert.strictEqual(localScope.parent, globalScope)
      assert.strictEqual(localScope.resolutions.get('foo'), undefined)

      const bar = NumberFacet.with(undefined).type()
      localScope.resolutions.set('bar', bar)
      assert.strictEqual(localScope.resolutions.get('bar'), bar)
      assert.strictEqual(globalScope.resolutions.get('bar'), undefined)

      const nestedLocalScope = createLocalScope(localScope)
      assert.strictEqual(nestedLocalScope.top, globalScope)
      assert.strictEqual(nestedLocalScope.parent, localScope)
      assert.strictEqual(nestedLocalScope.resolutions.get('foo'), undefined)
      assert.strictEqual(nestedLocalScope.resolutions.get('bar'), undefined)
    })
  })

  describe('createNamespace()', () => {
    it('should create a namespace with empty resolutions', () => {
      const namespace = createNamespace()

      assert.strictEqual(namespace.resolutions.size, 0)
    })
  })
})
