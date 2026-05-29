import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { FunctionContext } from '../../../src/compiler/functions.js'
import { instrumentsModule } from '../../../src/compiler/modules/instruments.js'
import { FunctionType } from '../../../src/compiler/types.js'

function createFunctionContext (): FunctionContext {
  return {
    instruments: new Map(),
    automations: new Map()
  }
}

describe('compiler/modules/instruments.ts', () => {
  const instruments = instrumentsModule.data

  describe('sample', () => {
    const sample = instruments.exports.get('sample')
    assert.ok(sample != null && FunctionType.is(sample))

    it('should create instrument from sample', () => {
      const context = createFunctionContext()

      const result = sample.data.invoke(context, {
        url: 'https://example.com/kick.wav',
        gain: numeric('db', -3),
        root_note: 'C4',
        length: numeric('s', 1.5)
      })

      assert.deepStrictEqual(result.data, {
        id: 1,
        rootNote: 'C4',
        gain: { id: 1, initial: numeric('db', -3) },
        source: {
          type: 'sample',
          url: 'https://example.com/kick.wav',
          length: numeric('s', 1.5)
        }
      })

      assert.deepStrictEqual([...context.instruments.values()], [result.data])
    })

    it('should create instrument with default values', () => {
      const url = 'https://example.com/snare.wav'

      const context = createFunctionContext()

      const result = sample.data.invoke(context, { url })
      assert.deepStrictEqual(result.data, {
        id: 1,
        rootNote: undefined,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'sample', url, length: undefined }
      })
      assert.deepStrictEqual([...context.instruments.values()], [result.data])
    })
  })

  describe('sine', () => {
    const sine = instruments.exports.get('sine')
    assert.ok(sine != null && FunctionType.is(sine))

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = sine.data.invoke(context, {})
      assert.deepStrictEqual(result.data, {
        id: 1,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'sine' }
      })
      assert.deepStrictEqual([...context.instruments.values()], [result.data])
    })
  })

  describe('square', () => {
    const square = instruments.exports.get('square')
    assert.ok(square != null && FunctionType.is(square))

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = square.data.invoke(context, {})
      assert.deepStrictEqual(result.data, {
        id: 1,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'square' }
      })
      assert.deepStrictEqual([...context.instruments.values()], [result.data])
    })
  })

  describe('saw', () => {
    const saw = instruments.exports.get('saw')
    assert.ok(saw != null && FunctionType.is(saw))

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = saw.data.invoke(context, {})
      assert.deepStrictEqual(result.data, {
        id: 1,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'saw' }
      })
      assert.deepStrictEqual([...context.instruments.values()], [result.data])
    })
  })

  describe('triangle', () => {
    const triangle = instruments.exports.get('triangle')
    assert.ok(triangle != null && FunctionType.is(triangle))

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = triangle.data.invoke(context, {})
      assert.deepStrictEqual(result.data, {
        id: 1,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'triangle' }
      })
      assert.deepStrictEqual([...context.instruments.values()], [result.data])
    })
  })
})
