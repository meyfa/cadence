import type { Instrument } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { GenerateOptions } from '../../../src/compiler/generator/options.ts'
import { createGlobalScope, cloneScope, createLocalScope, createNamespace } from '../../../src/compiler/generator/scopes.ts'
import { Numbers } from '../../../src/type-system/helpers.ts'

const options: GenerateOptions = {
  beatsPerBar: 4,
  tempo: {
    default: 120 as Numeric<'bpm'>,
    minimum: 20 as Numeric<'bpm'>,
    maximum: 300 as Numeric<'bpm'>
  }
}

const scalar = (value: number) => value as Numeric<undefined>
const db = (value: number) => value as Numeric<'db'>

describe('compiler/generator/scopes.ts', () => {
  describe('createGlobalScope()', () => {
    it('should create a global scope with the provided options and initial resolutions', () => {
      const foo = Numbers.of(runtimeNumeric('db', 12))

      const result = createGlobalScope(options, new Map([['foo', foo]]))

      assert.strictEqual(result.top, result)
      assert.strictEqual(result.parent, undefined)

      assert.strictEqual(result.options, options)
      assert.strictEqual(result.resolutions.get('foo'), foo)

      assert.strictEqual(result.buses.size, 0)
      assert.strictEqual(result.instruments.size, 0)
      assert.strictEqual(result.automations.size, 0)
      assert.strictEqual(result.assets.size, 0)
    })

    it('should allocate buses with unique IDs', () => {
      const scope = createGlobalScope(options, new Map())

      const bus0 = {
        name: 'bus0',
        gain: scope.allocateParameter('db', db(0)),
        pan: scope.allocateParameter(undefined, scalar(0)),
        effects: []
      } as const

      const bus1 = {
        name: 'bus1',
        gain: scope.allocateParameter('db', db(-3)),
        pan: scope.allocateParameter(undefined, scalar(-0.5)),
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

      const parameter0 = scope.allocateParameter('db', db(12))
      const parameter1 = scope.allocateParameter('db', db(6))

      assert.strictEqual(parameter0.id, 0)
      assert.strictEqual(parameter1.id, 1)

      assert.deepStrictEqual([...scope.automations], [
        [0, { initial: 12, points: [] }],
        [1, { initial: 6, points: [] }]
      ])
    })

    it('should allocate instruments with unique IDs', () => {
      const scope = createGlobalScope(options, new Map())

      const instrument0 = {
        gain: scope.allocateParameter('db', db(-6)),
        trigger: () => []
      } satisfies Omit<Instrument, 'id'>

      const instrument1 = {
        gain: scope.allocateParameter('db', db(-3)),
        trigger: () => []
      } satisfies Omit<Instrument, 'id'>

      const allocated0 = scope.allocateInstrument(instrument0)
      const allocated1 = scope.allocateInstrument(instrument1)

      assert.strictEqual(allocated0.id, 0)
      assert.strictEqual(allocated1.id, 1)

      assert.deepStrictEqual([...scope.instruments], [
        [0, { ...instrument0, id: 0 }],
        [1, { ...instrument1, id: 1 }]
      ])
    })

    it('should allocate assets with unique IDs', () => {
      const scope = createGlobalScope(options, new Map())

      const asset0 = {
        url: 'foo.wav'
      } as const

      const asset1 = {
        url: 'bar.wav'
      } as const

      const allocated0 = scope.allocateAsset(asset0)
      const allocated1 = scope.allocateAsset(asset1)

      assert.strictEqual(allocated0.id, 0)
      assert.strictEqual(allocated1.id, 1)

      assert.deepStrictEqual([...scope.assets], [
        [0, { ...asset0, id: 0 }],
        [1, { ...asset1, id: 1 }]
      ])
    })
  })

  describe('createLocalScope()', () => {
    it('should create a local scope with the provided parent and empty resolutions', () => {
      const globalScope = createGlobalScope(options, new Map([
        ['foo', Numbers.of(runtimeNumeric('db', 12))]
      ]))

      const localScope = createLocalScope(globalScope)

      assert.strictEqual(localScope.top, globalScope)
      assert.strictEqual(localScope.parent, globalScope)
      assert.strictEqual(localScope.resolutions.get('foo'), undefined)

      const bar = Numbers.of(runtimeNumeric('db', 6))
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

  describe('cloneScope()', () => {
    it('should create a new scope with the same top and parent, and a copy of the resolutions', () => {
      const globalScope = createGlobalScope(options, new Map([
        ['foo', Numbers.of(runtimeNumeric('db', 12))]
      ]))

      const localScope = createLocalScope(globalScope)
      localScope.resolutions.set('bar', Numbers.of(runtimeNumeric('db', 6)))

      const clonedScope = cloneScope(localScope)

      assert.strictEqual(clonedScope.top, globalScope)
      assert.strictEqual(clonedScope.parent, globalScope)
      assert.strictEqual(clonedScope.resolutions.has('foo'), false)
      assert.strictEqual(clonedScope.resolutions.has('bar'), true)
    })

    it('should not be affected by changes to the original scope after cloning', () => {
      const globalScope = createGlobalScope(options, new Map([
        ['foo', Numbers.of(runtimeNumeric('db', 12))]
      ]))

      const localScope = createLocalScope(globalScope)
      localScope.resolutions.set('bar', Numbers.of(runtimeNumeric('db', 6)))

      const clonedScope = cloneScope(localScope)

      localScope.resolutions.set('baz', Numbers.of(runtimeNumeric('db', 3)))

      assert.strictEqual(clonedScope.resolutions.get('baz'), undefined)
    })
  })

  describe('createNamespace()', () => {
    it('should create a namespace with empty resolutions', () => {
      const namespace = createNamespace()

      assert.strictEqual(namespace.resolutions.size, 0)
    })
  })
})
