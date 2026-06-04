import { createSerialPattern, loopPattern, renderPatternEvents } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { FunctionContext } from '../../../src/compiler/functions.js'
import { patternsModule } from '../../../src/compiler/modules/patterns.js'
import { Numbers } from '../../../src/compiler/type-helpers.js'
import { FunctionFacet } from '../../../src/type-system/base/function.js'
import { ModuleFacet } from '../../../src/type-system/base/module.js'
import { PatternFacet } from '../../../src/type-system/domain/pattern.js'

function createFunctionContext (): FunctionContext {
  return {
    instruments: new Map(),
    automations: new Map()
  }
}

describe('compiler/modules/patterns.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => numeric('beats', value)

  const patterns = ModuleFacet.get(patternsModule)

  describe('loop', () => {
    const loopValue = patterns.exports.get('loop')
    assert.ok(loopValue != null && FunctionFacet.has(loopValue))
    const loop = FunctionFacet.get(loopValue)

    it('should loop finite patterns infinitely', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: '-' },
        { value: 'G5' }
      ], 4))
      const context = createFunctionContext()

      const result = loop.invoke(context, { pattern })
      const resultPattern = PatternFacet.get(result)
      assert.strictEqual(resultPattern.length, undefined)

      const events = renderPatternEvents(resultPattern, beats(2.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.25) },
        { time: beats(0.75), gate: beats(0.25), pitch: 'G5' },
        { time: beats(1), gate: beats(0.25) },
        { time: beats(1.75), gate: beats(0.25), pitch: 'G5' }
      ])
    })

    it('should keep infinite patterns infinite', () => {
      const pattern = PatternFacet.type().of(loopPattern(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2)))
      const context = createFunctionContext()

      const result = loop.invoke(context, { pattern })
      const resultPattern = PatternFacet.get(result)
      assert.strictEqual(resultPattern.length, undefined)

      const events = renderPatternEvents(resultPattern, beats(2.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5) },
        { time: beats(1), gate: beats(0.5), pitch: 'C4' },
        { time: beats(1.5), gate: beats(0.5) }
      ])
    })

    it('should return empty pattern when looping empty pattern', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([], 4))
      const context = createFunctionContext()

      const result = loop.invoke(context, { pattern })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length?.value, 0)

      const events = renderPatternEvents(resultPattern, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should support times parameter', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2))
      const context = createFunctionContext()

      const result = loop.invoke(context, {
        pattern,
        times: Numbers.of(numeric(undefined, 3))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(1.5 * 3))

      const events = renderPatternEvents(resultPattern, beats(5.0))

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
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2))
      const context = createFunctionContext()

      const result = loop.invoke(context, {
        pattern,
        times: Numbers.of(numeric(undefined, 0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length?.value, 0)

      const events = renderPatternEvents(resultPattern, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should treat negative times parameter as zero', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2))
      const context = createFunctionContext()

      const result = loop.invoke(context, {
        pattern,
        times: Numbers.of(numeric(undefined, -2))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length?.value, 0)

      const events = renderPatternEvents(resultPattern, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should support fractional times parameter', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2))
      const context = createFunctionContext()

      const result = loop.invoke(context, {
        pattern,
        times: Numbers.of(numeric(undefined, 0.5))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(1.5 * 0.5))

      const events = renderPatternEvents(resultPattern, beats(2.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5) }
      ])
    })
  })

  describe('fill', () => {
    const fillValue = patterns.exports.get('fill')
    assert.ok(fillValue != null && FunctionFacet.has(fillValue))
    const fill = FunctionFacet.get(fillValue)

    it('should loop finite patterns until the duration is filled', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2))
      const context = createFunctionContext()

      const result = fill.invoke(context, {
        pattern,
        duration: Numbers.of(beats(2.0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(2.0))

      const events = renderPatternEvents(resultPattern, beats(5.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5) },
        { time: beats(1), gate: beats(0.5), pitch: 'C4' },
        { time: beats(1.5), gate: beats(0.5) }
      ])
    })

    it('should truncate infinite patterns to the requested duration', () => {
      const pattern = PatternFacet.type().of(loopPattern(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2)))
      const context = createFunctionContext()

      const result = fill.invoke(context, {
        pattern,
        duration: Numbers.of(beats(2.0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(2.0))

      const events = renderPatternEvents(resultPattern, beats(5.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5) },
        { time: beats(1), gate: beats(0.5), pitch: 'C4' },
        { time: beats(1.5), gate: beats(0.5) }
      ])
    })

    it('should return empty pattern when filling an empty pattern', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([], 4))
      const context = createFunctionContext()

      const result = fill.invoke(context, {
        pattern,
        duration: Numbers.of(beats(2.0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length?.value, 0)

      const events = renderPatternEvents(resultPattern, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should return empty pattern when duration is zero', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2))
      const context = createFunctionContext()

      const result = fill.invoke(context, {
        pattern,
        duration: Numbers.of(beats(0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length?.value, 0)

      const events = renderPatternEvents(resultPattern, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should treat negative duration as empty', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2))
      const context = createFunctionContext()

      const result = fill.invoke(context, {
        pattern,
        duration: Numbers.of(beats(-2.0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length?.value, 0)

      const events = renderPatternEvents(resultPattern, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should treat non-finite duration as empty', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2))
      const context = createFunctionContext()

      const result = fill.invoke(context, {
        pattern,
        duration: Numbers.of(beats(Number.POSITIVE_INFINITY))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length?.value, 0)

      const events = renderPatternEvents(resultPattern, beats(2.0))
      assert.deepStrictEqual(events, [])
    })

    it('should trim notes with gate that extends beyond the duration', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'A4', gate: numeric(undefined, 3) },
        { value: 'B4', gate: numeric(undefined, 5) }
      ], 1))
      const context = createFunctionContext()

      const result = fill.invoke(context, {
        pattern,
        duration: Numbers.of(beats(4.0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(4.0))

      const events = renderPatternEvents(resultPattern, beats(4.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(3.0), pitch: 'A4' },
        { time: beats(1), gate: beats(3.0), pitch: 'B4' },
        { time: beats(2), gate: beats(2.0), pitch: 'A4' },
        { time: beats(3), gate: beats(1.0), pitch: 'B4' }
      ])
    })
  })
})
