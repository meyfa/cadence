import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { GenerateOptions } from '../../src/compiler/options.js'
import { createGlobalScope, createLocalScope, resolveInScope } from '../../src/compiler/scopes.js'
import { Numbers } from '../../src/type-system/helpers.js'

const options: GenerateOptions = {
  beatsPerBar: 4,
  tempo: {
    default: 120,
    minimum: 20,
    maximum: 300
  }
}

describe('compiler/scopes.ts', () => {
  describe('createGlobalScope()', () => {
    it('should create a global scope with the provided options and initial resolutions', () => {
      const foo = Numbers.of(numeric('db', 12))

      const result = createGlobalScope(options, new Map([['foo', foo]]))

      assert.strictEqual(result.top, result)
      assert.strictEqual(result.parent, undefined)

      assert.strictEqual(result.options, options)
      assert.strictEqual(result.resolutions.get('foo'), foo)

      assert.strictEqual(result.buses.size, 0)
      assert.strictEqual(result.instruments.size, 0)
      assert.strictEqual(result.automations.size, 0)
    })

    it('should allocate buses with unique IDs', () => {
      const scope = createGlobalScope(options, new Map())

      const bus1 = {
        name: 'bus1',
        gain: scope.allocateParameter(numeric('db', 0)),
        pan: scope.allocateParameter(numeric(undefined, 0)),
        effects: []
      } as const

      const bus2 = {
        name: 'bus2',
        gain: scope.allocateParameter(numeric('db', -3)),
        pan: scope.allocateParameter(numeric(undefined, -0.5)),
        effects: []
      } as const

      const allocated1 = scope.allocateBus(bus1)
      const allocated2 = scope.allocateBus(bus2)

      assert.strictEqual(allocated1.id, 0)
      assert.strictEqual(allocated2.id, 1)

      assert.deepStrictEqual([...scope.buses], [
        ['bus1', { ...bus1, id: 0 }],
        ['bus2', { ...bus2, id: 1 }]
      ])
    })

    it('should allocate parameters with unique IDs', () => {
      const scope = createGlobalScope(options, new Map())

      const param1 = scope.allocateParameter(numeric('db', 12))
      const param2 = scope.allocateParameter(numeric('db', 6))

      assert.strictEqual(param1.id, 1)
      assert.strictEqual(param2.id, 2)

      assert.deepStrictEqual([...scope.automations], [
        [1, { parameterId: 1, points: [] }],
        [2, { parameterId: 2, points: [] }]
      ])
    })

    it('should allocate instruments with unique IDs', () => {
      const scope = createGlobalScope(options, new Map())

      const instrument1 = {
        gain: scope.allocateParameter(numeric('db', -6)),
        source: {
          type: 'oscillator',
          shape: 'sine'
        },
        envelope: {
          attack: numeric('s', 0.1),
          decay: numeric('s', 0.2),
          sustain: numeric(undefined, 0.5),
          release: numeric('s', 0.5)
        }
      } as const

      const instrument2 = {
        gain: scope.allocateParameter(numeric('db', -3)),
        source: {
          type: 'oscillator',
          shape: 'square'
        },
        envelope: {
          attack: numeric('s', 0.01),
          decay: numeric('s', 0.1),
          sustain: numeric(undefined, 0.8),
          release: numeric('s', 0.3)
        }
      } as const

      const allocated1 = scope.allocateInstrument(instrument1)
      const allocated2 = scope.allocateInstrument(instrument2)

      assert.strictEqual(allocated1.id, 1)
      assert.strictEqual(allocated2.id, 2)

      assert.deepStrictEqual([...scope.instruments], [
        [1, { ...instrument1, id: 1 }],
        [2, { ...instrument2, id: 2 }]
      ])
    })
  })

  describe('createLocalScope()', () => {
    it('should create a local scope with the provided parent and empty resolutions', () => {
      const globalScope = createGlobalScope(options, new Map([
        ['foo', Numbers.of(numeric('db', 12))]
      ]))

      const localScope = createLocalScope(globalScope)

      assert.strictEqual(localScope.top, globalScope)
      assert.strictEqual(localScope.parent, globalScope)
      assert.strictEqual(localScope.resolutions.get('foo'), undefined)

      const bar = Numbers.of(numeric('db', 6))
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

  describe('resolveInScope()', () => {
    it('should resolve names in the current scope and parent scopes', () => {
      const globalFoo = Numbers.of(numeric('db', 1))

      const localBar = Numbers.of(numeric('db', 2))

      const globalBaz = Numbers.of(numeric('db', 3))
      const localBaz = Numbers.of(numeric('db', 4))

      const globalScope = createGlobalScope(options, new Map([
        ['foo', globalFoo],
        ['baz', globalBaz]
      ]))

      const localScope = createLocalScope(globalScope)
      localScope.resolutions.set('bar', localBar)
      localScope.resolutions.set('baz', localBaz)

      const nestedLocalScope = createLocalScope(localScope)

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
