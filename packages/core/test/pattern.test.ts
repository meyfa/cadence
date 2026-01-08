import assert from 'node:assert'
import { describe, it } from 'node:test'
import { concatPatterns, createParallelPattern, createSerialPattern, loopPattern, mergePatterns, multiplyPattern, renderPatternEvents } from '../src/pattern.js'
import { makeNumeric } from '../src/program.js'

describe('pattern.ts', () => {
  // helper to create Numeric<'beats'>
  const beats = (value: number) => makeNumeric('beats', value)

  describe('createSerialPattern()', () => {
    it('should create a finite pattern with the correct length and events', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'x' }
      ], 1)
      assert.strictEqual(pattern.length?.value, 3)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: beats(0), gate: beats(1) },
        { time: beats(2), gate: beats(1) }
      ])
    })

    it('should create an empty pattern when given an empty array', () => {
      const pattern = createSerialPattern([], 1)
      assert.strictEqual(pattern.length?.value, 0)
      assert.deepStrictEqual([...pattern.evaluate()], [])
    })

    it('should adapt to subdivision', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'x' }
      ], 2)
      assert.strictEqual(pattern.length?.value, 1.5)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: beats(0), gate: beats(0.5) },
        { time: beats(1), gate: beats(0.5) }
      ])
    })

    it('should handle steps with custom lengths', () => {
      const pattern = createSerialPattern([
        { value: 'x', length: makeNumeric(undefined, 2) },
        { value: '-' },
        { value: 'x', length: makeNumeric(undefined, 0.5) }
      ], 1)
      assert.strictEqual(pattern.length?.value, 3.5)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: beats(0), gate: beats(2) },
        { time: beats(3), gate: beats(0.5) }
      ])
    })

    it('should skip steps with non-positive lengths', () => {
      const pattern = createSerialPattern([
        { value: 'C1', length: makeNumeric(undefined, 0) },
        { value: 'C2', length: makeNumeric(undefined, -1) },
        { value: 'C3' }
      ], 1)
      assert.strictEqual(pattern.length?.value, 1)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { pitch: 'C3', time: beats(0), gate: beats(1) }
      ])
    })

    it('should handle steps with custom gates', () => {
      const pattern = createSerialPattern([
        { value: 'x', gate: makeNumeric(undefined, 0.5) },
        { value: '-' },
        { value: 'x', gate: makeNumeric(undefined, 0.25) }
      ], 1)
      assert.strictEqual(pattern.length?.value, 3)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: beats(0), gate: beats(0.5) },
        { time: beats(2), gate: beats(0.25) }
      ])
    })

    it('should handle steps with both custom lengths and gates', () => {
      const pattern = createSerialPattern([
        { value: 'x', length: makeNumeric(undefined, 2), gate: makeNumeric(undefined, 1.5) },
        { value: '-' },
        { value: 'x', length: makeNumeric(undefined, 0.5), gate: makeNumeric(undefined, 0.1) }
      ], 1)
      assert.strictEqual(pattern.length?.value, 3.5)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: beats(0), gate: beats(1.5) },
        { time: beats(3), gate: beats(0.1) }
      ])
    })
  })

  describe('createParallelPattern()', () => {
    it('should create an empty pattern when given an empty array', () => {
      const pattern = createParallelPattern([])
      assert.strictEqual(pattern.length?.value, 0)
      assert.deepStrictEqual([...pattern.evaluate()], [])
    })

    it('should create a finite pattern with default length 1', () => {
      const pattern = createParallelPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'x' }
      ])
      assert.strictEqual(pattern.length?.value, 1)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: beats(0), gate: beats(1) },
        { time: beats(0), gate: beats(1) }
      ])
    })

    it('should use the maximum step length as the pattern length', () => {
      const pattern = createParallelPattern([
        { value: 'x', length: makeNumeric(undefined, 2) },
        { value: '-' },
        { value: 'x', length: makeNumeric(undefined, 0.5) }
      ])
      assert.strictEqual(pattern.length?.value, 2)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: beats(0), gate: beats(2) },
        { time: beats(0), gate: beats(0.5) }
      ])
    })

    it('should handle steps with custom gates', () => {
      const pattern = createParallelPattern([
        { value: 'x', gate: makeNumeric(undefined, 0.5) },
        { value: '-' },
        { value: 'x', gate: makeNumeric(undefined, 0.25) }
      ])
      assert.strictEqual(pattern.length?.value, 1)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: beats(0), gate: beats(0.5) },
        { time: beats(0), gate: beats(0.25) }
      ])
    })

    it('should handle steps with both custom lengths and gates', () => {
      const pattern = createParallelPattern([
        { value: 'x', length: makeNumeric(undefined, 2), gate: makeNumeric(undefined, 1.5) },
        { value: '-' },
        { value: 'x', length: makeNumeric(undefined, 0.5), gate: makeNumeric(undefined, 0.1) }
      ])
      assert.strictEqual(pattern.length?.value, 2)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: beats(0), gate: beats(1.5) },
        { time: beats(0), gate: beats(0.1) }
      ])
    })
  })

  describe('concatPatterns()', () => {
    it('should return an empty pattern when given no patterns', () => {
      const concatenated = concatPatterns([])
      assert.strictEqual(concatenated.length?.value, 0)
      assert.deepStrictEqual([...concatenated.evaluate()], [])
    })

    it('should return the same pattern when given a single pattern', () => {
      const pattern = createSerialPattern([{ value: 'x' }, { value: '-' }], 1)
      const concatenated = concatPatterns([pattern])
      assert.strictEqual(concatenated, pattern)
    })

    it('should concatenate two finite patterns correctly', () => {
      const concatenated = concatPatterns([
        createSerialPattern([{ value: 'x' }, { value: '-' }], 1),
        createSerialPattern([{ value: '-' }, { value: 'x' }, { value: 'x' }], 2)
      ])
      assert.strictEqual(concatenated.length?.value, 3.5)
      assert.deepStrictEqual([...concatenated.evaluate()], [
        { time: beats(0), gate: beats(1) },
        { time: beats(2.5), gate: beats(0.5) },
        { time: beats(3), gate: beats(0.5) }
      ])
    })

    it('should return the second pattern if the first is empty', () => {
      const first = createSerialPattern([], 1)
      const second = createSerialPattern([{ value: 'x' }, { value: '-' }], 1)
      const concatenated = concatPatterns([first, second])
      assert.strictEqual(concatenated, second)
    })

    it('should return the first pattern if the second is empty', () => {
      const first = createSerialPattern([{ value: 'x' }, { value: '-' }], 1)
      const second = createSerialPattern([], 1)
      const concatenated = concatPatterns([first, second])
      assert.strictEqual(concatenated, first)
    })

    it('should return the first pattern if it is infinite', () => {
      const first = loopPattern(createSerialPattern([{ value: 'x' }, { value: '-' }], 1))
      const second = createSerialPattern([{ value: '-' }, { value: 'x' }], 1)
      const concatenated = concatPatterns([first, second])
      assert.strictEqual(concatenated, first)
    })
  })

  describe('mergePatterns()', () => {
    it('should return an empty pattern when given no patterns', () => {
      const parallel = mergePatterns([])
      assert.strictEqual(parallel.length?.value, 0)
      assert.deepStrictEqual([...parallel.evaluate()], [])
    })

    it('should return the same pattern when given a single pattern', () => {
      const pattern = createSerialPattern([{ value: 'x' }, { value: '-' }], 1)
      const parallel = mergePatterns([pattern])
      assert.strictEqual(parallel, pattern)
    })

    it('should combine multiple patterns correctly', () => {
      const parallel = mergePatterns([
        createSerialPattern([{ value: 'x' }, { value: '-' }], 1),
        createSerialPattern([{ value: '-' }, { value: 'x' }], 1)
      ])
      assert.strictEqual(parallel.length?.value, 2)
      assert.deepStrictEqual([...parallel.evaluate()], [
        { time: beats(0), gate: beats(1) },
        { time: beats(1), gate: beats(1) }
      ])
    })

    it('should handle patterns of different lengths', () => {
      const parallel = mergePatterns([
        createSerialPattern([{ value: 'x' }, { value: '-' }, { value: 'x' }], 1),
        createSerialPattern([{ value: '-' }, { value: 'x' }], 1)
      ])
      assert.strictEqual(parallel.length?.value, 3)
      assert.deepStrictEqual([...parallel.evaluate()], [
        { time: beats(0), gate: beats(1) },
        { time: beats(1), gate: beats(1) },
        { time: beats(2), gate: beats(1) }
      ])
    })

    it('should handle infinite patterns', () => {
      const parallel = mergePatterns([
        loopPattern(createSerialPattern([{ value: 'x' }, { value: '-' }], 1)),
        createSerialPattern([{ value: '-' }, { value: 'x' }], 1)
      ])
      assert.strictEqual(parallel.length, undefined)

      const evaluated = []
      const iterator = parallel.evaluate()[Symbol.iterator]()

      for (let i = 0; i < 4; i++) {
        evaluated.push(iterator.next().value)
      }

      assert.deepStrictEqual(evaluated, [
        { time: beats(0), gate: beats(1) },
        { time: beats(1), gate: beats(1) },
        { time: beats(2), gate: beats(1) },
        { time: beats(4), gate: beats(1) }
      ])
    })

    it('should produce steps in the correct order', () => {
      const parallel = mergePatterns([
        createSerialPattern([{ value: 'x' }, { value: '-' }, { value: 'x' }], 1),
        createSerialPattern([{ value: '-' }, { value: '-' }, { value: 'x' }], 1),
        createSerialPattern([{ value: 'x' }, { value: 'x' }], 4),
        createSerialPattern([{ value: 'x' }, { value: 'x' }], 2)
      ])
      assert.strictEqual(parallel.length?.value, 3)
      assert.deepStrictEqual([...parallel.evaluate()], [
        { time: beats(0), gate: beats(1) },
        { time: beats(0), gate: beats(0.25) },
        { time: beats(0), gate: beats(0.5) },
        { time: beats(0.25), gate: beats(0.25) },
        { time: beats(0.5), gate: beats(0.5) },
        { time: beats(2), gate: beats(1) },
        { time: beats(2), gate: beats(1) }
      ])
    })
  })

  describe('loopPattern()', () => {
    it('should create an infinite pattern when no duration is provided', () => {
      const pattern = createSerialPattern([{ value: 'x' }, { value: '-' }, { value: '-' }], 2)
      const looped = loopPattern(pattern)

      assert.strictEqual(looped.length, undefined)

      const evaluated = []
      const iterator = looped.evaluate()[Symbol.iterator]()

      for (let i = 0; i < 4; i++) {
        evaluated.push(iterator.next().value)
      }

      assert.deepStrictEqual(evaluated, [
        { time: beats(0), gate: beats(0.5) },
        { time: beats(1.5), gate: beats(0.5) },
        { time: beats(3), gate: beats(0.5) },
        { time: beats(4.5), gate: beats(0.5) }
      ])
    })

    it('should loop a finite pattern to a specific length', () => {
      const pattern = createSerialPattern([{ value: 'x' }, { value: '-' }], 1)
      const looped = loopPattern(pattern, beats(5))

      assert.strictEqual(looped.length?.value, 5)

      const evaluated = [...looped.evaluate()]
      assert.deepStrictEqual(evaluated, [
        { time: beats(0), gate: beats(1) },
        { time: beats(2), gate: beats(1) },
        { time: beats(4), gate: beats(1) }
      ])
    })

    it('should return the same pattern if it is infinite and no duration is provided', () => {
      const pattern = loopPattern(createSerialPattern([{ value: 'x' }, { value: '-' }], 1))
      const looped = loopPattern(pattern)
      assert.strictEqual(looped, pattern)
    })

    it('should return empty pattern when looping an empty pattern', () => {
      const pattern = loopPattern(createSerialPattern([], 1), beats(10))
      assert.strictEqual(pattern.length?.value, 0)
      assert.deepStrictEqual([...pattern.evaluate()], [])
    })

    it('should return empty pattern when looping an empty pattern infinitely', () => {
      const pattern = loopPattern(createSerialPattern([], 1))
      assert.strictEqual(pattern.length?.value, 0)
      assert.deepStrictEqual([...pattern.evaluate()], [])
    })
  })

  describe('multiplyPattern()', () => {
    it('should return an empty pattern when multiplied by 0', () => {
      const pattern = createSerialPattern([{ value: 'x' }, { value: '-' }], 1)
      const multiplied = multiplyPattern(pattern, 0)
      assert.strictEqual(multiplied.length?.value, 0)
      assert.deepStrictEqual([...multiplied.evaluate()], [])
    })

    it('should return an empty pattern when multiplied by a negative number', () => {
      const pattern = createSerialPattern([{ value: 'x' }, { value: '-' }], 1)
      const multiplied = multiplyPattern(pattern, -1)
      assert.strictEqual(multiplied.length?.value, 0)
      assert.deepStrictEqual([...multiplied.evaluate()], [])
    })

    it('should keep pattern the same for factor of 1', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'x' }
      ], 1)
      const multiplied = multiplyPattern(pattern, 1)
      assert.strictEqual(multiplied.length?.value, 3)
      assert.deepStrictEqual([...multiplied.evaluate()], [
        { time: beats(0), gate: beats(1) },
        { time: beats(2), gate: beats(1) }
      ])
    })

    it('should multiply the length and timing of events by the given factor', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'x' }
      ], 1)
      const multiplied = multiplyPattern(pattern, 3)
      assert.strictEqual(multiplied.length?.value, 9)
      assert.deepStrictEqual([...multiplied.evaluate()], [
        { time: beats(0), gate: beats(3) },
        { time: beats(6), gate: beats(3) }
      ])
    })

    it('should keep infinite patterns infinite', () => {
      const pattern = loopPattern(createSerialPattern([{ value: 'x' }, { value: '-' }], 1))
      const multiplied = multiplyPattern(pattern, 4)
      assert.strictEqual(multiplied.length, undefined)

      const evaluated = []
      const iterator = multiplied.evaluate()[Symbol.iterator]()

      for (let i = 0; i < 4; i++) {
        evaluated.push(iterator.next().value)
      }

      assert.deepStrictEqual(evaluated, [
        { time: beats(0), gate: beats(4) },
        { time: beats(8), gate: beats(4) },
        { time: beats(16), gate: beats(4) },
        { time: beats(24), gate: beats(4) }
      ])
    })

    it('should return an empty pattern when multiplying an empty pattern', () => {
      const pattern = createSerialPattern([], 1)
      const multiplied = multiplyPattern(pattern, 5)
      assert.strictEqual(multiplied.length?.value, 0)
      assert.deepStrictEqual([...multiplied.evaluate()], [])
    })

    it('should handle non-empty patterns with no events', () => {
      const pattern = createSerialPattern([{ value: '-' }, { value: '-' }, { value: '-' }], 1)
      const multiplied = multiplyPattern(pattern, 2)
      assert.strictEqual(multiplied.length?.value, 6)
      assert.deepStrictEqual([...multiplied.evaluate()], [])
    })

    it('should handle infinite patterns with no events', () => {
      const pattern = loopPattern(createSerialPattern([{ value: '-' }, { value: '-' }, { value: '-' }], 1))
      const multiplied = multiplyPattern(pattern, 2)
      assert.strictEqual(multiplied.length, undefined)
      assert.deepStrictEqual([...multiplied.evaluate()], [])
    })

    it('should handle fractional factors', () => {
      const pattern = createSerialPattern([{ value: 'x' }, { value: '-' }, { value: '-' }, { value: 'x' }], 1)
      const multiplied = multiplyPattern(pattern, 1 / 3)
      assert.strictEqual(multiplied.length?.value, 4 / 3)
      assert.deepStrictEqual([...multiplied.evaluate()], [
        { time: beats(0), gate: beats(1 / 3) },
        { time: beats(1), gate: beats(1 / 3) }
      ])
    })
  })

  describe('renderPatternEvents()', () => {
    it('should render the correct number of events from a finite pattern', () => {
      const pattern = createSerialPattern([{ value: 'x' }, { value: '-' }, { value: 'x' }, { value: 'x' }], 1)
      assert.deepStrictEqual(
        renderPatternEvents(pattern, beats(0)),
        []
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, beats(1)),
        [
          { time: beats(0), gate: beats(1) }
        ]
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, beats(3)),
        [
          { time: beats(0), gate: beats(1) },
          { time: beats(2), gate: beats(1) }
        ]
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, beats(4)),
        [
          { time: beats(0), gate: beats(1) },
          { time: beats(2), gate: beats(1) },
          { time: beats(3), gate: beats(1) }
        ]
      )
    })

    it('should not produce additional events', () => {
      assert.deepStrictEqual(
        renderPatternEvents(createSerialPattern([], 1), beats(2)),
        []
      )
      assert.deepStrictEqual(
        renderPatternEvents(createSerialPattern([{ value: 'x' }, { value: '-' }], 1), beats(8)),
        [
          { time: beats(0), gate: beats(1) }
        ]
      )
    })

    it('should truncate longer patterns', () => {
      const pattern = createSerialPattern([
        { value: 'x' },
        { value: '-' },
        { value: 'x' },
        { value: 'x' },
        { value: '-' },
        { value: 'x' }
      ], 1)
      assert.deepStrictEqual(
        renderPatternEvents(pattern, beats(3)),
        [
          { time: beats(0), gate: beats(1) },
          { time: beats(2), gate: beats(1) }
        ]
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, beats(2)),
        [
          { time: beats(0), gate: beats(1) }
        ]
      )
    })

    it('should render events from an infinite pattern', () => {
      const pattern = loopPattern(createSerialPattern([{ value: 'x' }, { value: '-' }], 1))
      assert.deepStrictEqual(
        renderPatternEvents(pattern, beats(0)),
        []
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, beats(1)),
        [
          { time: beats(0), gate: beats(1) }
        ]
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, beats(3)),
        [
          { time: beats(0), gate: beats(1) },
          { time: beats(2), gate: beats(1) }
        ]
      )
    })
  })
})
