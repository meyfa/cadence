import type { Envelope } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { FunctionContext } from '../../../src/compiler/functions.js'
import { instrumentsModule } from '../../../src/compiler/modules/instruments.js'
import { Numbers } from '../../../src/compiler/type-helpers.js'
import { FunctionFacet } from '../../../src/type-system/base/function.js'
import { ModuleFacet } from '../../../src/type-system/base/module.js'
import { StringFacet } from '../../../src/type-system/base/string.js'
import { InstrumentFacet } from '../../../src/type-system/domain/instrument.js'

function createFunctionContext (): FunctionContext {
  return {
    instruments: new Map(),
    automations: new Map()
  }
}

describe('compiler/modules/instruments.ts', () => {
  const instruments = ModuleFacet.get(instrumentsModule)

  const declickEnvelope: Envelope = {
    attack: numeric('s', 0.003),
    decay: numeric('s', 0),
    sustain: numeric(undefined, 1),
    release: numeric('s', 0.003)
  }

  describe('sample', () => {
    const sampleValue = instruments.exports.get('sample')
    assert.ok(sampleValue != null && FunctionFacet.has(sampleValue))
    const sample = FunctionFacet.get(sampleValue)

    it('should create instrument from sample', () => {
      const context = createFunctionContext()

      const result = sample.invoke(context, {
        url: StringFacet.type().of('https://example.com/kick.wav'),
        gain: Numbers.of(numeric('db', -3)),
        root_note: StringFacet.type().of('C4'),
        length: Numbers.of(numeric('s', 1.5))
      })

      assert.deepStrictEqual(InstrumentFacet.get(result), {
        id: 1,
        rootNote: 'C4',
        gain: { id: 1, initial: numeric('db', -3) },
        source: {
          type: 'sample',
          url: 'https://example.com/kick.wav',
          length: numeric('s', 1.5)
        },
        envelope: declickEnvelope
      })

      assert.deepStrictEqual([...context.instruments.values()], [InstrumentFacet.get(result)])
    })

    it('should create instrument with default values', () => {
      const url = 'https://example.com/snare.wav'

      const context = createFunctionContext()

      const result = sample.invoke(context, { url: StringFacet.type().of(url) })
      assert.deepStrictEqual(InstrumentFacet.get(result), {
        id: 1,
        rootNote: undefined,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'sample', url, length: undefined },
        envelope: declickEnvelope
      })
      assert.deepStrictEqual([...context.instruments.values()], [InstrumentFacet.get(result)])
    })
  })

  describe('sine', () => {
    const sineValue = instruments.exports.get('sine')
    assert.ok(sineValue != null && FunctionFacet.has(sineValue))
    const sine = FunctionFacet.get(sineValue)

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = sine.invoke(context, {})
      assert.deepStrictEqual(InstrumentFacet.get(result), {
        id: 1,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'sine' },
        envelope: declickEnvelope
      })
      assert.deepStrictEqual([...context.instruments.values()], [InstrumentFacet.get(result)])
    })
  })

  describe('square', () => {
    const squareValue = instruments.exports.get('square')
    assert.ok(squareValue != null && FunctionFacet.has(squareValue))
    const square = FunctionFacet.get(squareValue)

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = square.invoke(context, {})
      assert.deepStrictEqual(InstrumentFacet.get(result), {
        id: 1,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'square' },
        envelope: declickEnvelope
      })
      assert.deepStrictEqual([...context.instruments.values()], [InstrumentFacet.get(result)])
    })
  })

  describe('saw', () => {
    const sawValue = instruments.exports.get('saw')
    assert.ok(sawValue != null && FunctionFacet.has(sawValue))
    const saw = FunctionFacet.get(sawValue)

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = saw.invoke(context, {})
      assert.deepStrictEqual(InstrumentFacet.get(result), {
        id: 1,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'saw' },
        envelope: declickEnvelope
      })
      assert.deepStrictEqual([...context.instruments.values()], [InstrumentFacet.get(result)])
    })
  })

  describe('triangle', () => {
    const triangleValue = instruments.exports.get('triangle')
    assert.ok(triangleValue != null && FunctionFacet.has(triangleValue))
    const triangle = FunctionFacet.get(triangleValue)

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = triangle.invoke(context, {})
      assert.deepStrictEqual(InstrumentFacet.get(result), {
        id: 1,
        gain: { id: 1, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'triangle' },
        envelope: declickEnvelope
      })
      assert.deepStrictEqual([...context.instruments.values()], [InstrumentFacet.get(result)])
    })
  })
})
