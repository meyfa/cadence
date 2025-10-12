import assert from 'node:assert'
import { describe, it } from 'node:test'
import { withPatternLength } from '../../src/core/pattern.js'

describe('core/pattern.ts', () => {
  describe('withPatternLength()', () => {
    it('should return the same pattern if the length matches', () => {
      const pattern = ['hit', 'rest', 'hit'] as const
      const result = withPatternLength(pattern, 3)
      assert.deepStrictEqual(result, pattern)
    })

    it('should return a silent pattern if the input pattern is empty', () => {
      const result = withPatternLength([], 4)
      assert.deepStrictEqual(result, ['rest', 'rest', 'rest', 'rest'])
    })

    it('should repeat the pattern to reach the desired length', () => {
      const pattern = ['hit', 'rest', 'hit'] as const
      const result = withPatternLength(pattern, 5)
      assert.deepStrictEqual(result, ['hit', 'rest', 'hit', 'hit', 'rest'])
    })

    it('should truncate the pattern if the repeated length exceeds the desired length', () => {
      const pattern = ['hit', 'rest', 'hit', 'rest', 'hit'] as const
      const result = withPatternLength(pattern, 4)
      assert.deepStrictEqual(result, ['hit', 'rest', 'hit', 'rest'])
    })

    it('should handle non-integer lengths by flooring them', () => {
      const pattern = ['hit', 'rest'] as const
      const result = withPatternLength(pattern, 3.7)
      assert.deepStrictEqual(result, ['hit', 'rest', 'hit'])
    })

    it('should return an empty pattern for non-positive lengths', () => {
      assert.deepStrictEqual(withPatternLength(['hit'], 0), [])
      assert.deepStrictEqual(withPatternLength(['hit'], -2), [])
    })

    it('should return an empty pattern for non-safe integer lengths', () => {
      assert.deepStrictEqual(withPatternLength(['hit'], Infinity), [])
      assert.deepStrictEqual(withPatternLength(['hit'], Number.NaN), [])
      assert.deepStrictEqual(withPatternLength(['hit'], 1e20), [])
    })
  })

  describe('getSilentPattern()', () => {
    it('should return a silent pattern of the specified length', () => {
      const result = withPatternLength([], 3)
      assert.deepStrictEqual(result, ['rest', 'rest', 'rest'])
    })

    it('should handle non-integer lengths by flooring them', () => {
      const result = withPatternLength([], 4.9)
      assert.deepStrictEqual(result, ['rest', 'rest', 'rest', 'rest'])
    })

    it('should return an empty pattern for non-positive lengths', () => {
      assert.deepStrictEqual(withPatternLength([], 0), [])
      assert.deepStrictEqual(withPatternLength([], -5), [])
    })

    it('should return an empty pattern for non-safe integer lengths', () => {
      assert.deepStrictEqual(withPatternLength([], Infinity), [])
      assert.deepStrictEqual(withPatternLength([], Number.NaN), [])
      assert.deepStrictEqual(withPatternLength([], 1e20), [])
    })
  })
})
