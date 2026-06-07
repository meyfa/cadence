import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { GenerateOptions } from '../../../src/compiler/generator/options.js'
import { createGlobalScope, createLocalScope, createNamespace } from '../../../src/compiler/generator/scopes.js'
import { Numbers } from '../../../src/type-system/helpers.js'

const options: GenerateOptions = {
  beatsPerBar: 4,
  tempo: {
    default: 120,
    minimum: 20,
    maximum: 300
  }
}

describe('compiler/generator/scopes.ts', () => {
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

      const bus0 = {
        name: 'bus0',
        gain: scope.allocateParameter(numeric('db', 0)),
        pan: scope.allocateParameter(numeric(undefined, 0)),
        effects: []
      } as const

      const bus1 = {
        name: 'bus1',
        gain: scope.allocateParameter(numeric('db', -3)),
        pan: scope.allocateParameter(numeric(undefined, -0.5)),
        effects: []
      } as const

      const allocated1 = scope.allocateBus(bus0)
      const allocated2 = scope.allocateBus(bus1)

      assert.strictEqual(allocated1.id, 0)
      assert.strictEqual(allocated2.id, 1)

      assert.deepStrictEqual([...scope.buses], [
        [0, { ...bus0, id: 0 }],
        [1, { ...bus1, id: 1 }]
      ])
    })

    it('should allocate parameters with unique IDs', () => {
      const scope = createGlobalScope(options, new Map())

      const parameter0 = scope.allocateParameter(numeric('db', 12))
      const parameter1 = scope.allocateParameter(numeric('db', 6))

      assert.strictEqual(parameter0.id, 0)
      assert.strictEqual(parameter1.id, 1)

      assert.deepStrictEqual([...scope.automations], [
        [0, { parameterId: 0, points: [] }],
        [1, { parameterId: 1, points: [] }]
      ])
    })

    it('should allocate instruments with unique IDs', () => {
      const scope = createGlobalScope(options, new Map())

      const instrument0 = {
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

      const instrument1 = {
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

      const allocated0 = scope.allocateInstrument(instrument0)
      const allocated1 = scope.allocateInstrument(instrument1)

      assert.strictEqual(allocated0.id, 0)
      assert.strictEqual(allocated1.id, 1)

      assert.deepStrictEqual([...scope.instruments], [
        [0, { ...instrument0, id: 0 }],
        [1, { ...instrument1, id: 1 }]
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

  describe('createNamespace()', () => {
    it('should create a namespace with empty resolutions', () => {
      const namespace = createNamespace()

      assert.strictEqual(namespace.resolutions.size, 0)
    })
  })
})
