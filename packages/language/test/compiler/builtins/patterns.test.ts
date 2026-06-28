import type { Pattern } from '@core'
import { createSerialPattern, loopPattern, renderPatternEvents } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { PatternBuiltin } from '../../../src/compiler/builtins/patterns.js'
import { patternBuiltins } from '../../../src/compiler/builtins/patterns.js'
import type { GlobalScope } from '../../../src/compiler/generator/scopes.js'
import { createGlobalScope } from '../../../src/compiler/generator/scopes.js'
import { FunctionFacet } from '../../../src/type-system/base/function.js'
import { PatternFacet } from '../../../src/type-system/domain/pattern.js'
import { Numbers } from '../../../src/type-system/helpers.js'
import type { Facet, Value } from '../../../src/type-system/types.js'

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

function getPatternBuiltin (name: string): PatternBuiltin {
  const builtin = patternBuiltins.get(name)
  assert.ok(builtin != null, `Pattern builtin '${name}' not found`)

  return builtin
}

function invoke (builtin: PatternBuiltin, self: Value<Facet<'pattern', Pattern>>, args: Record<string, Value>): Value {
  const context = createFunctionContext()
  const functionValue = builtin.bind(PatternFacet.get(self))

  return FunctionFacet.get(functionValue).invoke(context as never, args)
}

describe('library/modules/patterns.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => numeric('beats', value)

  describe('loop', () => {
    const loop = getPatternBuiltin('loop')

    it('should loop finite patterns infinitely', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x', velocity: numeric(undefined, 0.5) },
        { value: '-' },
        { value: '-' },
        { value: 'G5' }
      ], 4))

      const result = invoke(loop, pattern, {})
      const resultPattern = PatternFacet.get(result)
      assert.strictEqual(resultPattern.length, undefined)

      const events = renderPatternEvents(resultPattern, beats(2.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.25), velocity: numeric(undefined, 0.5) },
        { time: beats(0.75), gate: beats(0.25), pitch: 'G5', velocity: numeric(undefined, 1) },
        { time: beats(1), gate: beats(0.25), velocity: numeric(undefined, 0.5) },
        { time: beats(1.75), gate: beats(0.25), pitch: 'G5', velocity: numeric(undefined, 1) }
      ])
    })

    it('should keep infinite patterns infinite', () => {
      const pattern = PatternFacet.type().of(loopPattern(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2)))

      const result = invoke(loop, pattern, {})
      const resultPattern = PatternFacet.get(result)
      assert.strictEqual(resultPattern.length, undefined)

      const events = renderPatternEvents(resultPattern, beats(2.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5), velocity: numeric(undefined, 1) },
        { time: beats(1), gate: beats(0.5), pitch: 'C4', velocity: numeric(undefined, 1) },
        { time: beats(1.5), gate: beats(0.5), velocity: numeric(undefined, 1) }
      ])
    })

    it('should return empty pattern when looping empty pattern', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([], 4))

      const result = invoke(loop, pattern, {})
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

      const result = invoke(loop, pattern, {
        times: Numbers.of(numeric(undefined, 3))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(1.5 * 3))

      const events = renderPatternEvents(resultPattern, beats(5.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5), velocity: numeric(undefined, 1) },
        { time: beats(1), gate: beats(0.5), pitch: 'C4', velocity: numeric(undefined, 1) },
        { time: beats(1.5), gate: beats(0.5), velocity: numeric(undefined, 1) },
        { time: beats(2.5), gate: beats(0.5), pitch: 'C4', velocity: numeric(undefined, 1) },
        { time: beats(3.0), gate: beats(0.5), velocity: numeric(undefined, 1) },
        { time: beats(4.0), gate: beats(0.5), pitch: 'C4', velocity: numeric(undefined, 1) }
      ])
    })

    it('should support times parameter of zero', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2))

      const result = invoke(loop, pattern, {
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

      const result = invoke(loop, pattern, {
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

      const result = invoke(loop, pattern, {
        times: Numbers.of(numeric(undefined, 0.5))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(1.5 * 0.5))

      const events = renderPatternEvents(resultPattern, beats(2.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5), velocity: numeric(undefined, 1) }
      ])
    })
  })

  describe('fill', () => {
    const fill = getPatternBuiltin('fill')

    it('should loop finite patterns until the duration is filled', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4', velocity: numeric(undefined, 0.5) }
      ], 2))

      const result = invoke(fill, pattern, {
        duration: Numbers.of(beats(2.0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(2.0))

      const events = renderPatternEvents(resultPattern, beats(5.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5), velocity: numeric(undefined, 1) },
        { time: beats(1), gate: beats(0.5), pitch: 'C4', velocity: numeric(undefined, 0.5) },
        { time: beats(1.5), gate: beats(0.5), velocity: numeric(undefined, 1) }
      ])
    })

    it('should truncate infinite patterns to the requested duration', () => {
      const pattern = PatternFacet.type().of(loopPattern(createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'C4' }
      ], 2)))

      const result = invoke(fill, pattern, {
        duration: Numbers.of(beats(2.0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(2.0))

      const events = renderPatternEvents(resultPattern, beats(5.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(0.5), velocity: numeric(undefined, 1) },
        { time: beats(1), gate: beats(0.5), pitch: 'C4', velocity: numeric(undefined, 1) },
        { time: beats(1.5), gate: beats(0.5), velocity: numeric(undefined, 1) }
      ])
    })

    it('should return empty pattern when filling an empty pattern', () => {
      const pattern = PatternFacet.type().of(createSerialPattern([], 4))

      const result = invoke(fill, pattern, {
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

      const result = invoke(fill, pattern, {
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

      const result = invoke(fill, pattern, {
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

      const result = invoke(fill, pattern, {
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
        { value: 'B4', gate: numeric(undefined, 5), velocity: numeric(undefined, 0.5) }
      ], 1))

      const result = invoke(fill, pattern, {
        duration: Numbers.of(beats(4.0))
      })
      const resultPattern = PatternFacet.get(result)
      assert.deepStrictEqual(resultPattern.length, beats(4.0))

      const events = renderPatternEvents(resultPattern, beats(4.0))

      assert.deepStrictEqual(events, [
        { time: beats(0), gate: beats(3.0), pitch: 'A4', velocity: numeric(undefined, 1) },
        { time: beats(1), gate: beats(3.0), pitch: 'B4', velocity: numeric(undefined, 0.5) },
        { time: beats(2), gate: beats(2.0), pitch: 'A4', velocity: numeric(undefined, 1) },
        { time: beats(3), gate: beats(1.0), pitch: 'B4', velocity: numeric(undefined, 0.5) }
      ])
    })
  })
})
