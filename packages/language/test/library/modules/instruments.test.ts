import type { Envelope } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { GlobalScope } from '../../../src/compiler/scopes.js'
import { createGlobalScope } from '../../../src/compiler/scopes.js'
import { Numbers } from '../../../src/type-system/helpers.js'
import { instrumentsModule } from '../../../src/library/modules/instruments.js'
import { StringFacet } from '../../../src/type-system/base/string.js'
import { InstrumentFacet } from '../../../src/type-system/domain/instrument.js'
import { getFunctionExport } from './test-utils.js'

function createFunctionContext (): GlobalScope {
  return createGlobalScope({
    beatsPerBar: 4,
    tempo: {
      default: 120,
      minimum: 20,
      maximum: 300
    }
  }, new Map())
}

describe('library/modules/instruments.ts', () => {
  const declickEnvelope: Envelope = {
    attack: numeric('s', 0.003),
    decay: numeric('s', 0),
    sustain: numeric(undefined, 1),
    release: numeric('s', 0.003)
  }

  describe('sample', () => {
    const sample = getFunctionExport(instrumentsModule, 'sample')

    it('should create instrument from sample', () => {
      const context = createFunctionContext()

      const result = sample.invoke(context, {
        url: StringFacet.type().of('https://example.com/kick.wav'),
        gain: Numbers.of(numeric('db', -3)),
        root_note: StringFacet.type().of('C4'),
        length: Numbers.of(numeric('s', 1.5))
      })

      const { id, ...instrument } = InstrumentFacet.get(result)

      assert.deepStrictEqual(instrument, {
        rootNote: 'C4',
        gain: { id: instrument.gain.id, initial: numeric('db', -3) },
        source: {
          type: 'sample',
          url: 'https://example.com/kick.wav',
          length: numeric('s', 1.5)
        },
        envelope: declickEnvelope
      })

      assert.deepStrictEqual([...context.instruments], [
        [id, InstrumentFacet.get(result)]
      ])

      assert.deepStrictEqual([...context.automations.keys()], [instrument.gain.id])
    })

    it('should use default values', () => {
      const url = 'https://example.com/snare.wav'

      const context = createFunctionContext()

      const result = sample.invoke(context, {
        url: StringFacet.type().of(url)
      })

      const { id, ...instrument } = InstrumentFacet.get(result)

      assert.deepStrictEqual(instrument, {
        rootNote: undefined,
        gain: { id: instrument.gain.id, initial: numeric('db', 0) },
        source: { type: 'sample', url, length: undefined },
        envelope: declickEnvelope
      })

      assert.deepStrictEqual([...context.instruments], [
        [id, InstrumentFacet.get(result)]
      ])

      assert.deepStrictEqual([...context.automations.keys()], [instrument.gain.id])
    })
  })

  describe('sine', () => {
    const sine = getFunctionExport(instrumentsModule, 'sine')

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = sine.invoke(context, {})
      const { id, ...instrument } = InstrumentFacet.get(result)

      assert.deepStrictEqual(instrument, {
        gain: { id: instrument.gain.id, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'sine' },
        envelope: declickEnvelope
      })

      assert.deepStrictEqual([...context.instruments], [
        [id, InstrumentFacet.get(result)]
      ])

      assert.deepStrictEqual([...context.automations.keys()], [instrument.gain.id])
    })
  })

  describe('square', () => {
    const square = getFunctionExport(instrumentsModule, 'square')

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = square.invoke(context, {})
      const { id, ...instrument } = InstrumentFacet.get(result)

      assert.deepStrictEqual(instrument, {
        gain: { id: instrument.gain.id, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'square' },
        envelope: declickEnvelope
      })

      assert.deepStrictEqual([...context.instruments], [
        [id, InstrumentFacet.get(result)]
      ])

      assert.deepStrictEqual([...context.automations.keys()], [instrument.gain.id])
    })
  })

  describe('saw', () => {
    const saw = getFunctionExport(instrumentsModule, 'saw')

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = saw.invoke(context, {})
      const { id, ...instrument } = InstrumentFacet.get(result)

      assert.deepStrictEqual(instrument, {
        gain: { id: instrument.gain.id, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'saw' },
        envelope: declickEnvelope
      })

      assert.deepStrictEqual([...context.instruments], [
        [id, InstrumentFacet.get(result)]
      ])

      assert.deepStrictEqual([...context.automations.keys()], [instrument.gain.id])
    })
  })

  describe('triangle', () => {
    const triangle = getFunctionExport(instrumentsModule, 'triangle')

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = triangle.invoke(context, {})
      const { id, ...instrument } = InstrumentFacet.get(result)

      assert.deepStrictEqual(instrument, {
        gain: { id: instrument.gain.id, initial: numeric('db', 0) },
        source: { type: 'oscillator', shape: 'triangle' },
        envelope: declickEnvelope
      })

      assert.deepStrictEqual([...context.instruments], [
        [id, InstrumentFacet.get(result)]
      ])

      assert.deepStrictEqual([...context.automations.keys()], [instrument.gain.id])
    })
  })
})
