import { createSerialPattern, renderPatternEvents } from '@core/pattern.js'
import { makeNumeric } from '@core/program.js'
import { getDefaultFunctions, type FunctionContext } from '@language/compiler/functions.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { PatternType } from '../../src/compiler/types.js'

function createFunctionContext (): FunctionContext {
  return {
    instruments: new Map()
  }
}

describe('compiler/functions.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => makeNumeric('beats', value)

  const functions = getDefaultFunctions(['patterns', 'instruments', 'effects'])

  describe('loop', () => {
    const loop = functions.get('loop')
    assert.ok(loop != null)

    it('should loop finite patterns infinitely', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: '-' },
        { value: 'G5' }
      ], 4)
      const context = createFunctionContext()

      const result = loop.data.invoke(context, { pattern })
      const resultPattern = PatternType.cast(result)
      assert.strictEqual(resultPattern.data.length, undefined)

      const events = renderPatternEvents(resultPattern.data, beats(2.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.25) },
        { time: beats(0.75), gate: beats(0.25), pitch: 'G5' },
        { time: beats(1), gate: beats(0.25) },
        { time: beats(1.75), gate: beats(0.25), pitch: 'G5' }
      ])
    })

    it('should keep infinite patterns infinite', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2)
      const context = createFunctionContext()

      const result = loop.data.invoke(context, { pattern })
      const resultPattern = PatternType.cast(result)
      assert.strictEqual(resultPattern.data.length, undefined)

      const events = renderPatternEvents(resultPattern.data, beats(2.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5) },
        { time: beats(1), gate: beats(0.5), pitch: 'C4' },
        { time: beats(1.5), gate: beats(0.5) }
      ])
    })

    it('should return empty pattern when looping empty pattern', () => {
      const pattern = createSerialPattern([], 4)
      const context = createFunctionContext()

      const result = loop.data.invoke(context, { pattern })
      const resultPattern = PatternType.cast(result)
      assert.deepStrictEqual(resultPattern.data.length?.value, 0)

      const events = renderPatternEvents(resultPattern.data, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should support times parameter', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2)
      const context = createFunctionContext()

      const result = loop.data.invoke(context, {
        pattern,
        times: makeNumeric(undefined, 3)
      })
      const resultPattern = PatternType.cast(result)
      assert.deepStrictEqual(resultPattern.data.length, beats(1.5 * 3))

      const events = renderPatternEvents(resultPattern.data, beats(5.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5) },
        { time: beats(1), gate: beats(0.5), pitch: 'C4' },
        { time: beats(1.5), gate: beats(0.5) },
        { time: beats(2.5), gate: beats(0.5), pitch: 'C4' },
        { time: beats(3.0), gate: beats(0.5) },
        { time: beats(4.0), gate: beats(0.5), pitch: 'C4' }
      ])
    })

    it('should support times parameter of zero', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2)
      const context = createFunctionContext()

      const result = loop.data.invoke(context, {
        pattern,
        times: makeNumeric(undefined, 0)
      })
      const resultPattern = PatternType.cast(result)
      assert.deepStrictEqual(resultPattern.data.length?.value, 0)

      const events = renderPatternEvents(resultPattern.data, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should treat negative times parameter as zero', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2)
      const context = createFunctionContext()

      const result = loop.data.invoke(context, {
        pattern,
        times: makeNumeric(undefined, -2)
      })
      const resultPattern = PatternType.cast(result)
      assert.deepStrictEqual(resultPattern.data.length?.value, 0)

      const events = renderPatternEvents(resultPattern.data, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should support fractional times parameter', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2)
      const context = createFunctionContext()

      const result = loop.data.invoke(context, {
        pattern,
        times: makeNumeric(undefined, 0.5)
      })
      const resultPattern = PatternType.cast(result)
      assert.deepStrictEqual(resultPattern.data.length, beats(1.5 * 0.5))

      const events = renderPatternEvents(resultPattern.data, beats(2.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5) }
      ])
    })
  })

  describe('sample', () => {
    const sample = functions.get('sample')
    assert.ok(sample != null)

    it('should create instrument from sample', () => {
      const context = createFunctionContext()

      const result = sample.data.invoke(context, {
        url: 'https://example.com/kick.wav',
        gain: makeNumeric('db', -3),
        root_note: 'C4',
        length: makeNumeric('s', 1.5)
      })

      assert.deepStrictEqual(result.data, {
        id: 1,
        sampleUrl: 'https://example.com/kick.wav',
        gain: makeNumeric('db', -3),
        rootNote: 'C4',
        length: makeNumeric('s', 1.5)
      })

      assert.strictEqual(context.instruments.size, 1)
      const instrument = [...context.instruments.values()][0]

      assert.strictEqual(instrument, result.data)
    })

    it('should create instrument with default values', () => {
      const context = createFunctionContext()

      const result = sample.data.invoke(context, {
        url: 'https://example.com/snare.wav'
      })

      assert.deepStrictEqual(result.data, {
        id: 1,
        sampleUrl: 'https://example.com/snare.wav',
        gain: undefined,
        rootNote: undefined,
        length: undefined
      })

      assert.strictEqual(context.instruments.size, 1)
      const instrument = [...context.instruments.values()][0]

      assert.strictEqual(instrument, result.data)
    })
  })

  describe('gain', () => {
    const gain = functions.get('gain')
    assert.ok(gain != null)

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
    const pan = functions.get('pan')
    assert.ok(pan != null)

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
    const delay = functions.get('delay')
    assert.ok(delay != null)

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
    const reverb = functions.get('reverb')
    assert.ok(reverb != null)

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
