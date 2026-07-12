import type { Instrument } from '@core'
import type { Numeric } from '@utility'
import { runtimeNumeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { GlobalScope } from '../../../src/compiler/generator/scopes.js'
import { createGlobalScope } from '../../../src/compiler/generator/scopes.js'
import { applyEnvelope } from '../../../src/library/envelope.js'
import { instrumentsModule } from '../../../src/library/modules/instruments.js'
import { StringFacet } from '../../../src/type-system/base/string.js'
import { InstrumentFacet } from '../../../src/type-system/domain/instrument.js'
import { Numbers } from '../../../src/type-system/helpers.js'
import { getFunctionExport } from './test-utils.js'

const DEFAULT_TEMPO = runtimeNumeric('bpm', 120)

function createFunctionContext (): GlobalScope {
  return createGlobalScope({
    beatsPerBar: 4,
    tempo: {
      default: DEFAULT_TEMPO.value,
      minimum: 20,
      maximum: 300
    }
  }, new Map())
}

describe('library/modules/instruments.ts', () => {
  const declickEnvelope = () => applyEnvelope({
    attack: runtimeNumeric('s', 0.003),
    decay: runtimeNumeric('s', 0),
    sustain: runtimeNumeric('db', 0),
    release: runtimeNumeric('s', 0.003)
  }, {
    velocity: 1 as Numeric<undefined>,
    gate: 1.5 as Numeric<'s'>
  })

  describe('sample', () => {
    const sample = getFunctionExport(instrumentsModule, 'sample')

    it('should create instrument from sample', () => {
      const context = createFunctionContext()

      const result = sample.invoke(context, {
        url: StringFacet.type().of('https://example.com/kick.wav'),
        gain: Numbers.of(runtimeNumeric('db', -3)),
        root_note: StringFacet.type().of('C4'),
        length: Numbers.of(runtimeNumeric('s', 1.5))
      })

      const [asset] = context.assets.values()
      assert.strictEqual(asset.url, 'https://example.com/kick.wav')

      const instrument = InstrumentFacet.get(result)

      assert.deepStrictEqual(instrument, {
        id: instrument.id,
        gain: { id: instrument.gain.id, initial: runtimeNumeric('db', -3) },
        trigger: instrument.trigger
      } satisfies Instrument)

      assert.deepStrictEqual(instrument.trigger({ velocity: 1 as Numeric<undefined> }, DEFAULT_TEMPO), [
        {
          envelope: declickEnvelope(),
          duration: runtimeNumeric('s', 1.503),
          source: {
            type: 'sample',
            assetId: asset.id,
            length: runtimeNumeric('s', 1.5),
            playbackRate: runtimeNumeric(undefined, 1)
          }
        }
      ])

      assert.deepStrictEqual([...context.instruments], [
        [instrument.id, InstrumentFacet.get(result)]
      ])

      assert.deepStrictEqual([...context.automations.keys()], [instrument.gain.id])
    })

    it('should use default values', () => {
      const url = 'https://example.com/snare.wav'

      const context = createFunctionContext()

      const result = sample.invoke(context, {
        url: StringFacet.type().of(url)
      })

      const [asset] = context.assets.values()
      assert.strictEqual(asset.url, url)

      const { id, ...instrument } = InstrumentFacet.get(result)

      assert.deepStrictEqual(instrument, {
        gain: { id: instrument.gain.id, initial: runtimeNumeric('db', 0) },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ velocity: 1 as Numeric<undefined> }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: runtimeNumeric('s', 0.003),
            decay: runtimeNumeric('s', 0),
            sustain: runtimeNumeric('db', 0),
            release: runtimeNumeric('s', 0.003)
          }, {
            gate: undefined,
            velocity: 1 as Numeric<undefined>
          }),
          duration: undefined,
          source: {
            type: 'sample',
            assetId: asset.id,
            length: undefined,
            playbackRate: runtimeNumeric(undefined, 1)
          }
        }
      ])

      assert.deepStrictEqual([...context.instruments], [
        [id, InstrumentFacet.get(result)]
      ])

      assert.deepStrictEqual([...context.automations.keys()], [instrument.gain.id])
    })

    it('should not produce voices if length is invalid', () => {
      for (const length of [0, -1, -Infinity, Infinity, Number.NaN]) {
        const context = createFunctionContext()

        const result = sample.invoke(context, {
          url: StringFacet.type().of('https://example.com/kick.wav'),
          length: Numbers.of(runtimeNumeric('s', length))
        })

        const instrument = InstrumentFacet.get(result)
        const voices = instrument.trigger({ velocity: 1 as Numeric<undefined> }, DEFAULT_TEMPO)

        assert.strictEqual(voices.length, 0)
      }
    })
  })

  describe('sine', () => {
    const sine = getFunctionExport(instrumentsModule, 'sine')

    it('should create oscillator instrument', () => {
      const context = createFunctionContext()

      const result = sine.invoke(context, {})
      const { id, ...instrument } = InstrumentFacet.get(result)

      assert.deepStrictEqual(instrument, {
        gain: { id: instrument.gain.id, initial: runtimeNumeric('db', 0) },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ pitch: 'A4', velocity: 1 as Numeric<undefined> }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: runtimeNumeric('s', 0.003),
            decay: runtimeNumeric('s', 0),
            sustain: runtimeNumeric('db', 0),
            release: runtimeNumeric('s', 0.003)
          }, {
            gate: undefined,
            velocity: 1 as Numeric<undefined>
          }),
          duration: undefined,
          source: {
            type: 'oscillator',
            shape: 'sine',
            frequency: runtimeNumeric('hz', 440)
          }
        }
      ])

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
        gain: { id: instrument.gain.id, initial: runtimeNumeric('db', 0) },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ pitch: 'A4', velocity: 1 as Numeric<undefined> }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: runtimeNumeric('s', 0.003),
            decay: runtimeNumeric('s', 0),
            sustain: runtimeNumeric('db', 0),
            release: runtimeNumeric('s', 0.003)
          }, {
            gate: undefined,
            velocity: 1 as Numeric<undefined>
          }),
          duration: undefined,
          source: {
            type: 'oscillator',
            shape: 'square',
            frequency: runtimeNumeric('hz', 440)
          }
        }
      ])

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
        gain: { id: instrument.gain.id, initial: runtimeNumeric('db', 0) },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ pitch: 'A4', velocity: 1 as Numeric<undefined> }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: runtimeNumeric('s', 0.003),
            decay: runtimeNumeric('s', 0),
            sustain: runtimeNumeric('db', 0),
            release: runtimeNumeric('s', 0.003)
          }, {
            gate: undefined,
            velocity: 1 as Numeric<undefined>
          }),
          duration: undefined,
          source: {
            type: 'oscillator',
            shape: 'saw',
            frequency: runtimeNumeric('hz', 440)
          }
        }
      ])

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
        gain: { id: instrument.gain.id, initial: runtimeNumeric('db', 0) },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ pitch: 'A4', velocity: 1 as Numeric<undefined> }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: runtimeNumeric('s', 0.003),
            decay: runtimeNumeric('s', 0),
            sustain: runtimeNumeric('db', 0),
            release: runtimeNumeric('s', 0.003)
          }, {
            gate: undefined,
            velocity: 1 as Numeric<undefined>
          }),
          duration: undefined,
          source: {
            type: 'oscillator',
            shape: 'triangle',
            frequency: runtimeNumeric('hz', 440)
          }
        }
      ])

      assert.deepStrictEqual([...context.instruments], [
        [id, InstrumentFacet.get(result)]
      ])

      assert.deepStrictEqual([...context.automations.keys()], [instrument.gain.id])
    })
  })
})
