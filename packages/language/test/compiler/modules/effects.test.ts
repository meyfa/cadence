import { makeNumeric } from '@core/program.js'
import { type FunctionContext } from '@language/compiler/functions.js'
import { effectsModule } from '@language/compiler/modules/effects.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { FunctionType } from '../../../src/compiler/types.js'

function createFunctionContext (): FunctionContext {
  return {
    instruments: new Map()
  }
}

describe('compiler/modules/effects.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => makeNumeric('beats', value)

  const effects = effectsModule.data

  describe('gain', () => {
    const gain = effects.exports.get('gain')
    assert.ok(gain != null && FunctionType.is(gain))

    it('should create gain effect', () => {
      const context = createFunctionContext()
      const result = gain.data.invoke(context, {
        gain: makeNumeric('db', -6)
      })

      assert.deepStrictEqual(result.data, {
        type: 'gain',
        gain: makeNumeric('db', -6)
      })
    })
  })

  describe('pan', () => {
    const pan = effects.exports.get('pan')
    assert.ok(pan != null && FunctionType.is(pan))

    it('should create pan effect', () => {
      const context = createFunctionContext()
      const result = pan.data.invoke(context, {
        pan: makeNumeric(undefined, 0.5)
      })

      assert.deepStrictEqual(result.data, {
        type: 'pan',
        pan: makeNumeric(undefined, 0.5)
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
        feedback: makeNumeric(undefined, 0.3)
      })

      assert.deepStrictEqual(result.data, {
        type: 'delay',
        time: beats(0.5),
        feedback: makeNumeric(undefined, 0.3)
      })
    })
  })

  describe('reverb', () => {
    const reverb = effects.exports.get('reverb')
    assert.ok(reverb != null && FunctionType.is(reverb))

    it('should create reverb effect', () => {
      const context = createFunctionContext()
      const result = reverb.data.invoke(context, {
        decay: makeNumeric('s', 2.0),
        mix: makeNumeric(undefined, 0.4)
      })

      assert.deepStrictEqual(result.data, {
        type: 'reverb',
        decay: makeNumeric('s', 2.0),
        mix: makeNumeric(undefined, 0.4)
      })
    })
  })
})
