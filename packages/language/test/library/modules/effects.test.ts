import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { GlobalScope } from '../../../src/compiler/scopes.js'
import { createGlobalScope } from '../../../src/compiler/scopes.js'
import { effectsModule } from '../../../src/library/modules/effects.js'
import { RecordFacet } from '../../../src/type-system/base/record.js'
import { EffectFacet } from '../../../src/type-system/domain/effect.js'
import { Numbers } from '../../../src/type-system/helpers.js'
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

describe('library/modules/effects.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => numeric('beats', value)
  const seconds = (value: number) => numeric('s', value)

  describe('gain', () => {
    const gain = getFunctionExport(effectsModule, 'gain')

    it('should create gain effect', () => {
      const context = createFunctionContext()

      const result = gain.invoke(context, {
        gain: Numbers.of(numeric('db', -6))
      })

      const [gainId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'gain',
        gain: {
          id: gainId,
          initial: numeric('db', -6)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['gain'])
    })
  })

  describe('pan', () => {
    const pan = getFunctionExport(effectsModule, 'pan')

    it('should create pan effect', () => {
      const context = createFunctionContext()

      const result = pan.invoke(context, {
        pan: Numbers.of(numeric(undefined, 0.5))
      })

      const [panId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'pan',
        pan: {
          id: panId,
          initial: numeric(undefined, 0.5)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['pan'])
    })
  })

  describe('lowpass', () => {
    const lowpass = getFunctionExport(effectsModule, 'lowpass')

    it('should create lowpass effect', () => {
      const context = createFunctionContext()

      const result = lowpass.invoke(context, {
        frequency: Numbers.of(numeric('hz', 1000))
      })

      const [frequencyId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'lowpass',
        frequency: {
          id: frequencyId,
          initial: numeric('hz', 1000)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['frequency'])
    })
  })

  describe('highpass', () => {
    const highpass = getFunctionExport(effectsModule, 'highpass')

    it('should create highpass effect', () => {
      const context = createFunctionContext()

      const result = highpass.invoke(context, {
        frequency: Numbers.of(numeric('hz', 200))
      })

      const [frequencyId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'highpass',
        frequency: {
          id: frequencyId,
          initial: numeric('hz', 200)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['frequency'])
    })
  })

  describe('width', () => {
    const width = getFunctionExport(effectsModule, 'width')

    it('should create width effect', () => {
      const context = createFunctionContext()

      const result = width.invoke(context, {
        width: Numbers.of(numeric(undefined, 0.8))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'width',
        width: numeric(undefined, 0.8)
      })

      assert.strictEqual(RecordFacet.has(result), false)
    })
  })

  describe('delay', () => {
    const delay = getFunctionExport(effectsModule, 'delay')

    it('should create delay effect', () => {
      const context = createFunctionContext()

      const result = delay.invoke(context, {
        mix: Numbers.of(numeric(undefined, 0.5)),
        time: Numbers.of(beats(0.5)),
        feedback: Numbers.of(numeric(undefined, 0.3))
      })

      const [feedbackId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'delay',
        mix: numeric(undefined, 0.5),
        time: beats(0.5),
        feedback: {
          id: feedbackId,
          initial: numeric(undefined, 0.3)
        },
        wet: numeric('db', 0)
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['feedback'])
    })

    it('should create delay effect with seconds', () => {
      const context = createFunctionContext()

      const result = delay.invoke(context, {
        mix: Numbers.of(numeric(undefined, 0.5)),
        time: Numbers.of(seconds(1.5)),
        feedback: Numbers.of(numeric(undefined, 0.3))
      })

      const [feedbackId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'delay',
        mix: numeric(undefined, 0.5),
        time: seconds(1.5),
        feedback: {
          id: feedbackId,
          initial: numeric(undefined, 0.3)
        },
        wet: numeric('db', 0)
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['feedback'])
    })

    it('should accept optional wet parameter', () => {
      const context = createFunctionContext()

      const result = delay.invoke(context, {
        mix: Numbers.of(numeric(undefined, 0.5)),
        time: Numbers.of(beats(0.5)),
        feedback: Numbers.of(numeric(undefined, 0.3)),
        wet: Numbers.of(numeric('db', 3))
      })

      const effect = EffectFacet.get(result)
      assert.strictEqual(effect.type, 'delay')
      assert.deepStrictEqual(effect.wet, numeric('db', 3))
    })
  })

  describe('reverb', () => {
    const reverb = getFunctionExport(effectsModule, 'reverb')

    it('should create reverb effect', () => {
      const context = createFunctionContext()

      const result = reverb.invoke(context, {
        decay: Numbers.of(numeric('s', 2.0)),
        mix: Numbers.of(numeric(undefined, 0.4))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'reverb',
        decay: numeric('s', 2.0),
        mix: numeric(undefined, 0.4),
        wet: numeric('db', 0)
      })

      assert.strictEqual(RecordFacet.has(result), false)
    })

    it('should create reverb effect with beats', () => {
      const context = createFunctionContext()

      const result = reverb.invoke(context, {
        decay: Numbers.of(beats(2)),
        mix: Numbers.of(numeric(undefined, 0.4))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'reverb',
        decay: beats(2),
        mix: numeric(undefined, 0.4),
        wet: numeric('db', 0)
      })

      assert.strictEqual(RecordFacet.has(result), false)
    })

    it('should accept optional wet parameter', () => {
      const context = createFunctionContext()

      const result = reverb.invoke(context, {
        decay: Numbers.of(numeric('s', 2.0)),
        mix: Numbers.of(numeric(undefined, 0.4)),
        wet: Numbers.of(numeric('db', -3))
      })

      const effect = EffectFacet.get(result)
      assert.strictEqual(effect.type, 'reverb')
      assert.deepStrictEqual(effect.wet, numeric('db', -3))
    })
  })

  describe('clip', () => {
    const clip = getFunctionExport(effectsModule, 'clip')

    it('should create clip effect', () => {
      const context = createFunctionContext()

      const result = clip.invoke(context, {
        threshold: Numbers.of(numeric(undefined, 0.8))
      })

      const [thresholdId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'clip',
        threshold: {
          id: thresholdId,
          initial: numeric(undefined, 0.8)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['threshold'])
    })
  })
})
