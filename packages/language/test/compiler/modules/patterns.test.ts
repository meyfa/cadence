import { createSerialPattern, renderPatternEvents } from '@core/pattern.js'
import { makeNumeric } from '@core/program.js'
import { type FunctionContext } from '@language/compiler/functions.js'
import { patternsModule } from '@language/compiler/modules/patterns.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { FunctionType, PatternType } from '../../../src/compiler/types.js'

function createFunctionContext (): FunctionContext {
  return {
    instruments: new Map(),
    automations: new Map()
  }
}

describe('compiler/modules/patterns.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => makeNumeric('beats', value)

  const patterns = patternsModule.data

  describe('loop', () => {
    const loop = patterns.exports.get('loop')
    assert.ok(loop != null && FunctionType.is(loop))

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
})
