import { runtimeNumeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { GlobalScope } from '../../../src/compiler/generator/scopes.js'
import { createGlobalScope } from '../../../src/compiler/generator/scopes.js'
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
  // helper to create RuntimeNumeric<'beats'>
  const beats = (value: number) => runtimeNumeric('beats', value)
  const seconds = (value: number) => runtimeNumeric('s', value)

  describe('gain', () => {
    const gain = getFunctionExport(effectsModule, 'gain')

    it('should create gain effect', () => {
      const context = createFunctionContext()

      const result = gain.invoke(context, {
        gain: Numbers.of(runtimeNumeric('db', -6))
      })

      const [gainId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'gain',
        gain: {
          id: gainId,
          initial: runtimeNumeric('db', -6)
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
        pan: Numbers.of(runtimeNumeric(undefined, 0.5))
      })

      const [panId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'pan',
        pan: {
          id: panId,
          initial: runtimeNumeric(undefined, 0.5)
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
        frequency: Numbers.of(runtimeNumeric('hz', 1000))
      })

      const [frequencyId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'lowpass',
        frequency: {
          id: frequencyId,
          initial: runtimeNumeric('hz', 1000)
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
        frequency: Numbers.of(runtimeNumeric('hz', 200))
      })

      const [frequencyId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'highpass',
        frequency: {
          id: frequencyId,
          initial: runtimeNumeric('hz', 200)
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
        width: Numbers.of(runtimeNumeric(undefined, 0.8))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'width',
        width: runtimeNumeric(undefined, 0.8)
      })

      assert.strictEqual(RecordFacet.has(result), false)
    })
  })

  describe('delay', () => {
    const delay = getFunctionExport(effectsModule, 'delay')

    it('should create delay effect', () => {
      const context = createFunctionContext()

      const result = delay.invoke(context, {
        mix: Numbers.of(runtimeNumeric(undefined, 0.5)),
        time: Numbers.of(beats(0.5)),
        feedback: Numbers.of(runtimeNumeric(undefined, 0.3))
      })

      const [feedbackId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'delay',
        mix: runtimeNumeric(undefined, 0.5),
        time: beats(0.5),
        feedback: {
          id: feedbackId,
          initial: runtimeNumeric(undefined, 0.3)
        },
        wet: runtimeNumeric('db', 0)
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['feedback'])
    })

    it('should create delay effect with seconds', () => {
      const context = createFunctionContext()

      const result = delay.invoke(context, {
        mix: Numbers.of(runtimeNumeric(undefined, 0.5)),
        time: Numbers.of(seconds(1.5)),
        feedback: Numbers.of(runtimeNumeric(undefined, 0.3))
      })

      const [feedbackId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'delay',
        mix: runtimeNumeric(undefined, 0.5),
        time: seconds(1.5),
        feedback: {
          id: feedbackId,
          initial: runtimeNumeric(undefined, 0.3)
        },
        wet: runtimeNumeric('db', 0)
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['feedback'])
    })

    it('should accept optional wet parameter', () => {
      const context = createFunctionContext()

      const result = delay.invoke(context, {
        mix: Numbers.of(runtimeNumeric(undefined, 0.5)),
        time: Numbers.of(beats(0.5)),
        feedback: Numbers.of(runtimeNumeric(undefined, 0.3)),
        wet: Numbers.of(runtimeNumeric('db', 3))
      })

      const effect = EffectFacet.get(result)
      assert.strictEqual(effect.type, 'delay')
      assert.deepStrictEqual(effect.wet, runtimeNumeric('db', 3))
    })
  })

  describe('reverb', () => {
    const reverb = getFunctionExport(effectsModule, 'reverb')

    it('should create reverb effect', () => {
      const context = createFunctionContext()

      const result = reverb.invoke(context, {
        decay: Numbers.of(runtimeNumeric('s', 2.0)),
        mix: Numbers.of(runtimeNumeric(undefined, 0.4))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'reverb',
        decay: runtimeNumeric('s', 2.0),
        mix: runtimeNumeric(undefined, 0.4),
        wet: runtimeNumeric('db', 0)
      })

      assert.strictEqual(RecordFacet.has(result), false)
    })

    it('should create reverb effect with beats', () => {
      const context = createFunctionContext()

      const result = reverb.invoke(context, {
        decay: Numbers.of(beats(2)),
        mix: Numbers.of(runtimeNumeric(undefined, 0.4))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'reverb',
        decay: beats(2),
        mix: runtimeNumeric(undefined, 0.4),
        wet: runtimeNumeric('db', 0)
      })

      assert.strictEqual(RecordFacet.has(result), false)
    })

    it('should accept optional wet parameter', () => {
      const context = createFunctionContext()

      const result = reverb.invoke(context, {
        decay: Numbers.of(runtimeNumeric('s', 2.0)),
        mix: Numbers.of(runtimeNumeric(undefined, 0.4)),
        wet: Numbers.of(runtimeNumeric('db', -3))
      })

      const effect = EffectFacet.get(result)
      assert.strictEqual(effect.type, 'reverb')
      assert.deepStrictEqual(effect.wet, runtimeNumeric('db', -3))
    })
  })

  describe('clip', () => {
    const clip = getFunctionExport(effectsModule, 'clip')

    it('should create clip effect', () => {
      const context = createFunctionContext()

      const result = clip.invoke(context, {
        threshold: Numbers.of(runtimeNumeric(undefined, 0.8))
      })

      const [thresholdId] = context.automations.keys()

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'clip',
        threshold: {
          id: thresholdId,
          initial: runtimeNumeric(undefined, 0.8)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['threshold'])
    })
  })
})
