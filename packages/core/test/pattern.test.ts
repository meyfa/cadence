import assert from 'node:assert'
import { describe, it } from 'node:test'
import { concatPatterns, createPattern, loopPattern, multiplyPattern, renderPatternSteps } from '../src/pattern.js'

describe('pattern.ts', () => {
  describe('createPattern()', () => {
    it('should create a finite pattern with the correct length and steps', () => {
      const steps = ['x', '-', 'x'] as const
      const pattern = createPattern(steps)

      assert.strictEqual(pattern.finite, true)
      assert.strictEqual(pattern.length.value, steps.length)

      const evaluatedSteps = [...pattern.evaluate()]
      assert.deepStrictEqual(evaluatedSteps, steps)
    })

    it('should create an empty pattern when given an empty array', () => {
      const steps: readonly [] = []
      const pattern = createPattern(steps)

      assert.strictEqual(pattern.finite, true)
      assert.strictEqual(pattern.length.value, 0)

      const evaluatedSteps = [...pattern.evaluate()]
      assert.deepStrictEqual(evaluatedSteps, steps)
    })
  })

  describe('concatPatterns()', () => {
    it('should concatenate two finite patterns correctly', () => {
      const firstSteps = ['x', '-'] as const
      const secondSteps = ['-', 'x', 'x'] as const

      const first = createPattern(firstSteps)
      const second = createPattern(secondSteps)

      const concatenated = concatPatterns(first, second)

      assert.strictEqual(concatenated.finite, true)
      assert.strictEqual(concatenated.length.value, firstSteps.length + secondSteps.length)

      const evaluatedSteps = [...concatenated.evaluate()]
      assert.deepStrictEqual(evaluatedSteps, [...firstSteps, ...secondSteps])
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
    it('should create an infinite pattern when no step count is provided', () => {
      const steps = ['x', '-'] as const
      const pattern = createPattern(steps)
      const loopedPattern = loopPattern(pattern)

      assert.strictEqual(loopedPattern.finite, false)

      const evaluatedSteps = []
      const iterator = loopedPattern.evaluate()[Symbol.iterator]()

      for (let i = 0; i < 6; i++) {
        evaluatedSteps.push(iterator.next().value)
      }

      assert.deepStrictEqual(evaluatedSteps, ['x', '-', 'x', '-', 'x', '-'])
    })

    it('should loop a finite pattern to a specific number of steps', () => {
      const steps = ['x', '-'] as const
      const pattern = createPattern(steps)
      const loopedPattern = loopPattern(pattern, 5)

      assert.strictEqual(loopedPattern.finite, true)
      assert.strictEqual(loopedPattern.length.value, 5)

      const evaluatedSteps = [...loopedPattern.evaluate()]
      assert.deepStrictEqual(evaluatedSteps, ['x', '-', 'x', '-', 'x'])
    })

    it('should return the same pattern if it is infinite and no step count is provided', () => {
      const steps = ['x', '-'] as const
      const pattern = loopPattern(createPattern(steps))

      const loopedPattern = loopPattern(pattern)

      assert.strictEqual(loopedPattern, pattern)
    })
  })

  describe('multiplyPattern()', () => {
    it('should return an empty pattern when multiplied by 0', () => {
      const steps = ['x', '-'] as const
      const pattern = createPattern(steps)
      const multiplied = multiplyPattern(pattern, 0)

      assert.strictEqual(multiplied.finite, true)
      assert.strictEqual(multiplied.length.value, 0)

      const evaluatedSteps = [...multiplied.evaluate()]
      assert.deepStrictEqual(evaluatedSteps, [])
    })

    it('should repeat the pattern the specified number of times', () => {
      const steps = ['x', '-'] as const
      const pattern = createPattern(steps)
      const multiplied = multiplyPattern(pattern, 3)

      assert.strictEqual(multiplied.finite, true)
      assert.strictEqual(multiplied.length.value, steps.length * 3)

      const evaluatedSteps = [...multiplied.evaluate()]
      assert.deepStrictEqual(evaluatedSteps, ['x', '-', 'x', '-', 'x', '-'])
    })

    it('should handle fractional multiplication', () => {
      const steps = ['x', '-', 'x', '-'] as const
      const pattern = createPattern(steps)
      const multiplied = multiplyPattern(pattern, 1 / 3)

      assert.strictEqual(multiplied.finite, true)
      assert.strictEqual(multiplied.length.value, 1)

      const evaluatedSteps = [...multiplied.evaluate()]
      assert.deepStrictEqual(evaluatedSteps, ['x'])
    })

    it('should return an infinite pattern when multiplying an infinite pattern', () => {
      const steps = ['x', '-'] as const
      const pattern = createPattern(steps)
      const infinite = loopPattern(pattern)
      const multiplied = multiplyPattern(infinite, 5)

      assert.strictEqual(multiplied.finite, false)

      const evaluatedSteps = []
      const iterator = multiplied.evaluate()[Symbol.iterator]()

      for (let i = 0; i < 6; i++) {
        evaluatedSteps.push(iterator.next().value)
      }

      assert.deepStrictEqual(evaluatedSteps, ['x', '-', 'x', '-', 'x', '-'])
    })
  })

  describe('renderPatternSteps()', () => {
    it('should render the correct number of steps from a finite pattern', () => {
      const pattern = createPattern(['x', '-', 'x', 'x'])
      assert.deepStrictEqual(renderPatternSteps(pattern, 0), [])
      assert.deepStrictEqual(renderPatternSteps(pattern, 1), ['x'])
      assert.deepStrictEqual(renderPatternSteps(pattern, 3), ['x', '-', 'x'])
      assert.deepStrictEqual(renderPatternSteps(pattern, 4), ['x', '-', 'x', 'x'])
    })

    it('should pad with rests', () => {
      assert.deepStrictEqual(
        renderPatternSteps(createPattern([]), 2),
        ['-', '-']
      )
      assert.deepStrictEqual(
        renderPatternSteps(createPattern(['x', '-', 'x', 'x']), 8),
        ['x', '-', 'x', 'x', '-', '-', '-', '-']
      )
    })

    it('should truncate longer patterns', () => {
      const pattern = createPattern(['x', '-', 'x', 'x', '-', 'x'])
      assert.deepStrictEqual(renderPatternSteps(pattern, 4), ['x', '-', 'x', 'x'])
      assert.deepStrictEqual(renderPatternSteps(pattern, 2), ['x', '-'])
    })

    it('should render steps from an infinite pattern', () => {
      const pattern = loopPattern(createPattern(['x', '-']))
      assert.deepStrictEqual(renderPatternSteps(pattern, 0), [])
      assert.deepStrictEqual(renderPatternSteps(pattern, 1), ['x'])
      assert.deepStrictEqual(renderPatternSteps(pattern, 4), ['x', '-', 'x', '-'])
      assert.deepStrictEqual(renderPatternSteps(pattern, 7), ['x', '-', 'x', '-', 'x', '-', 'x'])
    })
  })
})
