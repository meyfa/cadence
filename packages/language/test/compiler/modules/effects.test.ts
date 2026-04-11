import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { FunctionContext } from '../../../src/compiler/functions.js'
import { effectsModule } from '../../../src/compiler/modules/effects.js'
import { FunctionType } from '../../../src/compiler/types.js'

function createFunctionContext (): FunctionContext {
  return {
    instruments: new Map(),
    automations: new Map()
  }
}

describe('compiler/modules/effects.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => numeric('beats', value)

  const effects = effectsModule.data

  describe('gain', () => {
    const gain = effects.exports.get('gain')
    assert.ok(gain != null && FunctionType.is(gain))

    it('should create gain effect', () => {
      const context = createFunctionContext()
      const result = gain.data.invoke(context, {
        gain: numeric('db', -6)
      })

      assert.deepStrictEqual(result.data, {
        type: 'gain',
        gain: numeric('db', -6)
      })
    })
  })

  describe('pan', () => {
    const pan = effects.exports.get('pan')
    assert.ok(pan != null && FunctionType.is(pan))

    it('should create pan effect', () => {
      const context = createFunctionContext()
      const result = pan.data.invoke(context, {
        pan: numeric(undefined, 0.5)
      })

      assert.deepStrictEqual(result.data, {
        type: 'pan',
        pan: numeric(undefined, 0.5)
      })
    })
  })

  describe('lowpass', () => {
    const lowpass = effects.exports.get('lowpass')
    assert.ok(lowpass != null && FunctionType.is(lowpass))

    it('should create lowpass effect', () => {
      const context = createFunctionContext()
      const result = lowpass.data.invoke(context, {
        frequency: numeric('hz', 1000)
      })

      assert.deepStrictEqual(result.data, {
        type: 'lowpass',
        frequency: numeric('hz', 1000)
      })
    })
  })

  describe('highpass', () => {
    const highpass = effects.exports.get('highpass')
    assert.ok(highpass != null && FunctionType.is(highpass))

    it('should create highpass effect', () => {
      const context = createFunctionContext()
      const result = highpass.data.invoke(context, {
        frequency: numeric('hz', 200)
      })

      assert.deepStrictEqual(result.data, {
        type: 'highpass',
        frequency: numeric('hz', 200)
      })
    })
  })

  describe('width', () => {
    const width = effects.exports.get('width')
    assert.ok(width != null && FunctionType.is(width))

    it('should create width effect', () => {
      const context = createFunctionContext()
      const result = width.data.invoke(context, {
        width: numeric(undefined, 0.8)
      })

      assert.deepStrictEqual(result.data, {
        type: 'width',
        width: numeric(undefined, 0.8)
      })
    })
  })

  describe('delay', () => {
    const delay = effects.exports.get('delay')
    assert.ok(delay != null && FunctionType.is(delay))

    it('should create delay effect', () => {
      const context = createFunctionContext()
      const result = delay.data.invoke(context, {
        time: beats(0.5),
        feedback: numeric(undefined, 0.3)
      })

      assert.deepStrictEqual(result.data, {
        type: 'delay',
        time: beats(0.5),
        feedback: numeric(undefined, 0.3)
      })
    })
  })

  describe('reverb', () => {
    const reverb = effects.exports.get('reverb')
    assert.ok(reverb != null && FunctionType.is(reverb))

    it('should create reverb effect', () => {
      const context = createFunctionContext()
      const result = reverb.data.invoke(context, {
        decay: numeric('s', 2.0),
        mix: numeric(undefined, 0.4)
      })

      assert.deepStrictEqual(result.data, {
        type: 'reverb',
        decay: numeric('s', 2.0),
        mix: numeric(undefined, 0.4)
      })
    })
  })
})
