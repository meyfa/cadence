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

const scalar = (value: number) => value as Numeric<undefined>
const seconds = (value: number) => value as Numeric<'s'>
const db = (value: number) => value as Numeric<'db'>
const hz = (value: number) => value as Numeric<'hz'>

const DEFAULT_TEMPO = 120 as Numeric<'bpm'>

function createFunctionContext (): GlobalScope {
  return createGlobalScope({
    beatsPerBar: 4,
    tempo: {
      default: DEFAULT_TEMPO,
      minimum: 20 as Numeric<'bpm'>,
      maximum: 300 as Numeric<'bpm'>
    }
  }, new Map())
}

describe('library/modules/instruments.ts', () => {
  const declickEnvelope = () => applyEnvelope({
    attack: seconds(0.003),
    decay: seconds(0),
    sustain: db(0),
    release: seconds(0.003)
  }, {
    velocity: scalar(1),
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
        label: 'sample(kick.wav)',
        gain: {
          id: instrument.gain.id,
          unit: 'db',
          initial: db(-3)
        },
        trigger: instrument.trigger
      } satisfies Instrument)

      assert.deepStrictEqual(instrument.trigger({ velocity: scalar(1) }, DEFAULT_TEMPO), [
        {
          envelope: declickEnvelope(),
          duration: seconds(1.503),
          source: {
            type: 'sample',
            assetId: asset.id,
            length: seconds(1.5),
            playbackRate: scalar(1)
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
        label: 'sample(snare.wav)',
        gain: {
          id: instrument.gain.id,
          unit: 'db',
          initial: db(0)
        },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ velocity: scalar(1) }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: seconds(0.003),
            decay: seconds(0),
            sustain: db(0),
            release: seconds(0.003)
          }, {
            gate: undefined,
            velocity: scalar(1)
          }),
          duration: undefined,
          source: {
            type: 'sample',
            assetId: asset.id,
            length: undefined,
            playbackRate: scalar(1)
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
        const voices = instrument.trigger({ velocity: scalar(1) }, DEFAULT_TEMPO)

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
        label: 'sine',
        gain: {
          id: instrument.gain.id,
          unit: 'db',
          initial: db(0)
        },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ pitch: 'A4', velocity: scalar(1) }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: seconds(0.003),
            decay: seconds(0),
            sustain: db(0),
            release: seconds(0.003)
          }, {
            gate: undefined,
            velocity: scalar(1)
          }),
          duration: undefined,
          source: {
            type: 'oscillator',
            shape: 'sine',
            frequency: hz(440)
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
        label: 'square',
        gain: {
          id: instrument.gain.id,
          unit: 'db',
          initial: db(0)
        },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ pitch: 'A4', velocity: scalar(1) }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: seconds(0.003),
            decay: seconds(0),
            sustain: db(0),
            release: seconds(0.003)
          }, {
            gate: undefined,
            velocity: scalar(1)
          }),
          duration: undefined,
          source: {
            type: 'oscillator',
            shape: 'square',
            frequency: hz(440)
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
        label: 'saw',
        gain: {
          id: instrument.gain.id,
          unit: 'db',
          initial: db(0)
        },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ pitch: 'A4', velocity: scalar(1) }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: seconds(0.003),
            decay: seconds(0),
            sustain: db(0),
            release: seconds(0.003)
          }, {
            gate: undefined,
            velocity: scalar(1)
          }),
          duration: undefined,
          source: {
            type: 'oscillator',
            shape: 'saw',
            frequency: hz(440)
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
        label: 'triangle',
        gain: {
          id: instrument.gain.id,
          unit: 'db',
          initial: db(0)
        },
        trigger: instrument.trigger
      })

      assert.deepStrictEqual(instrument.trigger({ pitch: 'A4', velocity: scalar(1) }, DEFAULT_TEMPO), [
        {
          envelope: applyEnvelope({
            attack: seconds(0.003),
            decay: seconds(0),
            sustain: db(0),
            release: seconds(0.003)
          }, {
            gate: undefined,
            velocity: scalar(1)
          }),
          duration: undefined,
          source: {
            type: 'oscillator',
            shape: 'triangle',
            frequency: hz(440)
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
