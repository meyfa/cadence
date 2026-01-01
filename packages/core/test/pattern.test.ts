import assert from 'node:assert'
import { describe, it } from 'node:test'
import { concatPatterns, createPattern, loopPattern, multiplyPattern, renderPatternEvents } from '../src/pattern.js'
import { makeNumeric } from '../src/program.js'

describe('pattern.ts', () => {
  describe('createPattern()', () => {
    it('should create a finite pattern with the correct length and events', () => {
      const pattern = createPattern(['x', '-', 'x'])
      assert.strictEqual(pattern.length?.value, 3)
      assert.deepStrictEqual([...pattern.evaluate()], [
        { time: makeNumeric('steps', 0) },
        { time: makeNumeric('steps', 2) }
      ])
    })

    it('should create an empty pattern when given an empty array', () => {
      const pattern = createPattern([])
      assert.strictEqual(pattern.length?.value, 0)
      assert.deepStrictEqual([...pattern.evaluate()], [])
    })
  })

  describe('concatPatterns()', () => {
    it('should concatenate two finite patterns correctly', () => {
      const concatenated = concatPatterns(createPattern(['x', '-']), createPattern(['-', 'x', 'x']))
      assert.strictEqual(concatenated.length?.value, 5)
      assert.deepStrictEqual([...concatenated.evaluate()], [
        { time: makeNumeric('steps', 0) },
        { time: makeNumeric('steps', 3) },
        { time: makeNumeric('steps', 4) }
      ])
    })

    it('should return the second pattern if the first is empty', () => {
      const first = createPattern([])
      const second = createPattern(['x', '-'])
      const concatenated = concatPatterns(first, second)
      assert.strictEqual(concatenated, second)
    })

    it('should return the first pattern if the second is empty', () => {
      const first = createPattern(['x', '-'])
      const second = createPattern([])
      const concatenated = concatPatterns(first, second)
      assert.strictEqual(concatenated, first)
    })

    it('should return the first pattern if it is infinite', () => {
      const first = loopPattern(createPattern(['x', '-']))
      const second = createPattern(['-', 'x'])
      const concatenated = concatPatterns(first, second)
      assert.strictEqual(concatenated, first)
    })
  })

  describe('loopPattern()', () => {
    it('should create an infinite pattern when no duration is provided', () => {
      const pattern = createPattern(['x', '-'])
      const looped = loopPattern(pattern)

      assert.strictEqual(looped.length, undefined)

      const evaluated = []
      const iterator = looped.evaluate()[Symbol.iterator]()

      for (let i = 0; i < 4; i++) {
        evaluated.push(iterator.next().value)
      }

      assert.deepStrictEqual(evaluated, [
        { time: makeNumeric('steps', 0) },
        { time: makeNumeric('steps', 2) },
        { time: makeNumeric('steps', 4) },
        { time: makeNumeric('steps', 6) }
      ])
    })

    it('should loop a finite pattern to a specific length', () => {
      const pattern = createPattern(['x', '-'])
      const looped = loopPattern(pattern, makeNumeric('steps', 5))

      assert.strictEqual(looped.length?.value, 5)

      const evaluated = [...looped.evaluate()]
      assert.deepStrictEqual(evaluated, [
        { time: makeNumeric('steps', 0) },
        { time: makeNumeric('steps', 2) },
        { time: makeNumeric('steps', 4) }
      ])
    })

    it('should return the same pattern if it is infinite and no duration is provided', () => {
      const pattern = loopPattern(createPattern(['x', '-']))
      const looped = loopPattern(pattern)
      assert.strictEqual(looped, pattern)
    })

    it('should return empty pattern when looping an empty pattern', () => {
      const pattern = loopPattern(createPattern([]), makeNumeric('steps', 10))
      assert.strictEqual(pattern.length?.value, 0)
      assert.deepStrictEqual([...pattern.evaluate()], [])
    })

    it('should return empty pattern when looping an empty pattern infinitely', () => {
      const pattern = loopPattern(createPattern([]))
      assert.strictEqual(pattern.length?.value, 0)
      assert.deepStrictEqual([...pattern.evaluate()], [])
    })
  })

  describe('multiplyPattern()', () => {
    it('should return an empty pattern when multiplied by 0', () => {
      const pattern = createPattern(['x', '-'])
      const multiplied = multiplyPattern(pattern, 0)
      assert.strictEqual(multiplied.length?.value, 0)
      assert.deepStrictEqual([...multiplied.evaluate()], [])
    })

    it('should repeat the pattern the specified number of times', () => {
      const pattern = createPattern(['x', '-'])
      const multiplied = multiplyPattern(pattern, 3)
      assert.strictEqual(multiplied.length?.value, 6)
      assert.deepStrictEqual([...multiplied.evaluate()], [
        { time: makeNumeric('steps', 0) },
        { time: makeNumeric('steps', 2) },
        { time: makeNumeric('steps', 4) }
      ])
    })

    it('should handle fractional multiplication', () => {
      const pattern = createPattern(['x', '-', 'x', '-'])
      const multiplied = multiplyPattern(pattern, 1 / 3)
      assert.strictEqual(multiplied.length?.value, 4 / 3)
      assert.deepStrictEqual([...multiplied.evaluate()], [
        { time: makeNumeric('steps', 0) }
      ])
    })

    it('should return an infinite pattern when multiplying an infinite pattern', () => {
      const pattern = loopPattern(createPattern(['x', '-']))
      const multiplied = multiplyPattern(pattern, 5)

      assert.strictEqual(multiplied.length, undefined)

      const evaluated = []
      const iterator = multiplied.evaluate()[Symbol.iterator]()

      for (let i = 0; i < 4; i++) {
        evaluated.push(iterator.next().value)
      }

      assert.deepStrictEqual(evaluated, [
        { time: makeNumeric('steps', 0) },
        { time: makeNumeric('steps', 2) },
        { time: makeNumeric('steps', 4) },
        { time: makeNumeric('steps', 6) }
      ])
    })

    it('should handle rest patterns correctly', () => {
      const pattern = createPattern(['-', '-'])
      const multiplied = multiplyPattern(pattern, 2)
      assert.strictEqual(multiplied.length?.value, 4)
      assert.deepStrictEqual([...multiplied.evaluate()], [])
    })
  })

  describe('renderPatternEvents()', () => {
    it('should render the correct number of events from a finite pattern', () => {
      const pattern = createPattern(['x', '-', 'x', 'x'])
      assert.deepStrictEqual(
        renderPatternEvents(pattern, makeNumeric('steps', 0)),
        []
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, makeNumeric('steps', 1)),
        [{ time: makeNumeric('steps', 0) }]
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, makeNumeric('steps', 3)),
        [{ time: makeNumeric('steps', 0) }, { time: makeNumeric('steps', 2) }]
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, makeNumeric('steps', 4)),
        [{ time: makeNumeric('steps', 0) }, { time: makeNumeric('steps', 2) }, { time: makeNumeric('steps', 3) }]
      )
    })

    it('should not produce additional events', () => {
      assert.deepStrictEqual(
        renderPatternEvents(createPattern([]), makeNumeric('steps', 2)),
        []
      )
      assert.deepStrictEqual(
        renderPatternEvents(createPattern(['x', '-']), makeNumeric('steps', 8)),
        [{ time: makeNumeric('steps', 0) }]
      )
    })

    it('should truncate longer patterns', () => {
      const pattern = createPattern(['x', '-', 'x', 'x', '-', 'x'])
      assert.deepStrictEqual(
        renderPatternEvents(pattern, makeNumeric('steps', 3)),
        [{ time: makeNumeric('steps', 0) }, { time: makeNumeric('steps', 2) }]
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, makeNumeric('steps', 2)),
        [{ time: makeNumeric('steps', 0) }]
      )
    })

    it('should render events from an infinite pattern', () => {
      const pattern = loopPattern(createPattern(['x', '-']))
      assert.deepStrictEqual(
        renderPatternEvents(pattern, makeNumeric('steps', 0)),
        []
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, makeNumeric('steps', 1)),
        [{ time: makeNumeric('steps', 0) }]
      )
      assert.deepStrictEqual(
        renderPatternEvents(pattern, makeNumeric('steps', 3)),
        [{ time: makeNumeric('steps', 0) }, { time: makeNumeric('steps', 2) }]
      )
    })
  })
})
