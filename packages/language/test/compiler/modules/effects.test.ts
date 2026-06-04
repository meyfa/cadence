import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { FunctionContext } from '../../../src/compiler/functions.js'
import { effectsModule } from '../../../src/compiler/modules/effects.js'
import { Numbers } from '../../../src/compiler/type-helpers.js'
import { FunctionFacet } from '../../../src/type-system/base/function.js'
import { ModuleFacet } from '../../../src/type-system/base/module.js'
import { EffectFacet } from '../../../src/type-system/domain/effect.js'

function createFunctionContext (): FunctionContext {
  return {
    instruments: new Map(),
    automations: new Map()
  }
}

describe('compiler/modules/effects.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => numeric('beats', value)
  const seconds = (value: number) => numeric('s', value)

  const effects = ModuleFacet.get(effectsModule)

  describe('gain', () => {
    const gainValue = effects.exports.get('gain')
    assert.ok(gainValue != null && FunctionFacet.has(gainValue))
    const gain = FunctionFacet.get(gainValue)

    it('should create gain effect', () => {
      const context = createFunctionContext()
      const result = gain.invoke(context, {
        gain: Numbers.of(numeric('db', -6))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'gain',
        gain: {
          id: 1,
          initial: numeric('db', -6)
        }
      })
    })
  })

  describe('pan', () => {
    const panValue = effects.exports.get('pan')
    assert.ok(panValue != null && FunctionFacet.has(panValue))
    const pan = FunctionFacet.get(panValue)

    it('should create pan effect', () => {
      const context = createFunctionContext()
      const result = pan.invoke(context, {
        pan: Numbers.of(numeric(undefined, 0.5))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'pan',
        pan: {
          id: 1,
          initial: numeric(undefined, 0.5)
        }
      })
    })
  })

  describe('lowpass', () => {
    const lowpassValue = effects.exports.get('lowpass')
    assert.ok(lowpassValue != null && FunctionFacet.has(lowpassValue))
    const lowpass = FunctionFacet.get(lowpassValue)

    it('should create lowpass effect', () => {
      const context = createFunctionContext()
      const result = lowpass.invoke(context, {
        frequency: Numbers.of(numeric('hz', 1000))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'lowpass',
        frequency: {
          id: 1,
          initial: numeric('hz', 1000)
        }
      })
    })
  })

  describe('highpass', () => {
    const highpassValue = effects.exports.get('highpass')
    assert.ok(highpassValue != null && FunctionFacet.has(highpassValue))
    const highpass = FunctionFacet.get(highpassValue)

    it('should create highpass effect', () => {
      const context = createFunctionContext()
      const result = highpass.invoke(context, {
        frequency: Numbers.of(numeric('hz', 200))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'highpass',
        frequency: {
          id: 1,
          initial: numeric('hz', 200)
        }
      })
    })
  })

  describe('width', () => {
    const widthValue = effects.exports.get('width')
    assert.ok(widthValue != null && FunctionFacet.has(widthValue))
    const width = FunctionFacet.get(widthValue)

    it('should create width effect', () => {
      const context = createFunctionContext()
      const result = width.invoke(context, {
        width: Numbers.of(numeric(undefined, 0.8))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'width',
        width: numeric(undefined, 0.8)
      })
    })
  })

  describe('delay', () => {
    const delayValue = effects.exports.get('delay')
    assert.ok(delayValue != null && FunctionFacet.has(delayValue))
    const delay = FunctionFacet.get(delayValue)

    it('should create delay effect', () => {
      const context = createFunctionContext()
      const result = delay.invoke(context, {
        mix: Numbers.of(numeric(undefined, 0.5)),
        time: Numbers.of(beats(0.5)),
        feedback: Numbers.of(numeric(undefined, 0.3))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'delay',
        mix: numeric(undefined, 0.5),
        time: beats(0.5),
        feedback: numeric(undefined, 0.3)
      })
    })

    it('should create delay effect with seconds', () => {
      const context = createFunctionContext()
      const result = delay.invoke(context, {
        mix: Numbers.of(numeric(undefined, 0.5)),
        time: Numbers.of(seconds(1.5)),
        feedback: Numbers.of(numeric(undefined, 0.3))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'delay',
        mix: numeric(undefined, 0.5),
        time: seconds(1.5),
        feedback: numeric(undefined, 0.3)
      })
    })
  })

  describe('reverb', () => {
    const reverbValue = effects.exports.get('reverb')
    assert.ok(reverbValue != null && FunctionFacet.has(reverbValue))
    const reverb = FunctionFacet.get(reverbValue)

    it('should create reverb effect', () => {
      const context = createFunctionContext()
      const result = reverb.invoke(context, {
        decay: Numbers.of(numeric('s', 2.0)),
        mix: Numbers.of(numeric(undefined, 0.4))
      })

      assert.deepStrictEqual(EffectFacet.get(result), {
        type: 'reverb',
        decay: numeric('s', 2.0),
        mix: numeric(undefined, 0.4)
      })
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
        mix: numeric(undefined, 0.4)
      })
    })
  })
})
