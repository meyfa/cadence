import type { ParameterId } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { effectsModule } from '../../../src/compiler/modules/effects.js'
import type { GlobalScope } from '../../../src/compiler/scopes.js'
import { createGlobalScope } from '../../../src/compiler/scopes.js'
import { Numbers } from '../../../src/compiler/type-helpers.js'
import { RecordFacet } from '../../../src/type-system/base/record.js'
import { EffectFacet } from '../../../src/type-system/domain/effect.js'
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

describe('compiler/modules/effects.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => numeric('beats', value)
  const seconds = (value: number) => numeric('s', value)

  describe('gain', () => {
    const gain = getFunctionExport(effectsModule, 'gain')

    it('should create gain effect', () => {
      const result = gain.invoke(createFunctionContext(), {
        gain: Numbers.of(numeric('db', -6))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'gain',
        gain: {
          id: 1,
          initial: numeric('db', -6)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['gain'])
    })
  })

  describe('pan', () => {
    const pan = getFunctionExport(effectsModule, 'pan')

    it('should create pan effect', () => {
      const result = pan.invoke(createFunctionContext(), {
        pan: Numbers.of(numeric(undefined, 0.5))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'pan',
        pan: {
          id: 1,
          initial: numeric(undefined, 0.5)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['pan'])
    })
  })

  describe('lowpass', () => {
    const lowpass = getFunctionExport(effectsModule, 'lowpass')

    it('should create lowpass effect', () => {
      const result = lowpass.invoke(createFunctionContext(), {
        frequency: Numbers.of(numeric('hz', 1000))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'lowpass',
        frequency: {
          id: 1,
          initial: numeric('hz', 1000)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['frequency'])
    })
  })

  describe('highpass', () => {
    const highpass = getFunctionExport(effectsModule, 'highpass')

    it('should create highpass effect', () => {
      const result = highpass.invoke(createFunctionContext(), {
        frequency: Numbers.of(numeric('hz', 200))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'highpass',
        frequency: {
          id: 1,
          initial: numeric('hz', 200)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['frequency'])
    })
  })

  describe('width', () => {
    const width = getFunctionExport(effectsModule, 'width')

    it('should create width effect', () => {
      const result = width.invoke(createFunctionContext(), {
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
      const result = delay.invoke(createFunctionContext(), {
        mix: Numbers.of(numeric(undefined, 0.5)),
        time: Numbers.of(beats(0.5)),
        feedback: Numbers.of(numeric(undefined, 0.3))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'delay',
        mix: numeric(undefined, 0.5),
        time: beats(0.5),
        feedback: {
          id: 1 as ParameterId,
          initial: numeric(undefined, 0.3)
        },
        wet: numeric('db', 0)
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['feedback'])
    })

    it('should create delay effect with seconds', () => {
      const result = delay.invoke(createFunctionContext(), {
        mix: Numbers.of(numeric(undefined, 0.5)),
        time: Numbers.of(seconds(1.5)),
        feedback: Numbers.of(numeric(undefined, 0.3))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'delay',
        mix: numeric(undefined, 0.5),
        time: seconds(1.5),
        feedback: {
          id: 1 as ParameterId,
          initial: numeric(undefined, 0.3)
        },
        wet: numeric('db', 0)
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['feedback'])
    })

    it('should accept optional wet parameter', () => {
      const result = delay.invoke(createFunctionContext(), {
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
      const result = reverb.invoke(createFunctionContext(), {
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
      const result = reverb.invoke(createFunctionContext(), {
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
      const result = reverb.invoke(createFunctionContext(), {
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
      const result = clip.invoke(createFunctionContext(), {
        threshold: Numbers.of(numeric(undefined, 0.8))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'clip',
        threshold: {
          id: 1 as ParameterId,
          initial: numeric(undefined, 0.8)
        }
      })

      assert.deepStrictEqual(Object.keys(RecordFacet.get(result)), ['threshold'])
    })
  })
})
