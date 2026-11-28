import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { Locatable, SourceRange } from '../src/range.ts'
import { areSourceRangesEqual, combineSourceRanges, getEmptySourceRange, getSourceRange } from '../src/range.ts'

describe('range.ts', () => {
  describe('getEmptySourceRange()', () => {
    it('should return a source range with zero length at the beginning of the file', () => {
      const range = getEmptySourceRange()
      assert.deepStrictEqual(range, { offset: 0, length: 0, line: 1, column: 1 })
    })
  })

  describe('getSourceRange()', () => {
    it('should extract source range from a Locatable', () => {
      const range: SourceRange = { offset: 8, length: 4, line: 3, column: 15 }
      assert.strictEqual(getSourceRange({ range }), range)
    })

    it('should include the file path if present', () => {
      const range: SourceRange = { offset: 5, length: 3, line: 2, column: 10, filePath: 'track.cadence' }
      assert.strictEqual(getSourceRange({ range }), range)
    })
  })

  describe('combineSourceRanges()', () => {
    it('should combine ranges of multiple Locatable items', () => {
      const item1: Locatable = { range: { offset: 5, length: 3, line: 2, column: 10, filePath: 'track.cadence' } }
      const item2: Locatable = { range: { offset: 8, length: 4, line: 3, column: 15, filePath: 'track.cadence' } }
      const item3: Locatable = { range: { offset: 12, length: 2, line: 4, column: 5, filePath: 'track.cadence' } }

      const combinedRange = combineSourceRanges(item1, item2, item3)
      assert.deepStrictEqual(combinedRange, { offset: 5, length: 9, line: 2, column: 10, filePath: 'track.cadence' })
    })

    it('should reject combining ranges from different files', () => {
      const item1: Locatable = { range: { offset: 5, length: 3, line: 2, column: 10, filePath: 'track-a.cadence' } }
      const item2: Locatable = { range: { offset: 8, length: 4, line: 3, column: 15, filePath: 'track-b.cadence' } }

      assert.throws(() => combineSourceRanges(item1, item2), /different files/)
    })

    it('should return empty range when no items are provided', () => {
      const combinedRange = combineSourceRanges()
      assert.deepStrictEqual(combinedRange, getEmptySourceRange())
    })
  })

  describe('areSourceRangesEqual()', () => {
    it('should return true for identical source ranges', () => {
      const range1: SourceRange = { offset: 5, length: 3, line: 2, column: 10, filePath: 'track.cadence' }
      const range2: SourceRange = { offset: 5, length: 3, line: 2, column: 10, filePath: 'track.cadence' }
      assert.strictEqual(areSourceRangesEqual(range1, range2), true)
    })

    it('should return false for different source ranges', () => {
      const range1: SourceRange = { offset: 5, length: 3, line: 2, column: 10, filePath: 'track.cadence' }
      const range2: SourceRange = { offset: 8, length: 4, line: 3, column: 15, filePath: 'track.cadence' }
      assert.strictEqual(areSourceRangesEqual(range1, range2), false)
    })

    it('should return false for ranges with different file paths', () => {
      const range1: SourceRange = { offset: 5, length: 3, line: 2, column: 10, filePath: 'track-a.cadence' }
      const range2: SourceRange = { offset: 5, length: 3, line: 2, column: 10, filePath: 'track-b.cadence' }
      assert.strictEqual(areSourceRangesEqual(range1, range2), false)
    })
  })
})
