import assert from 'node:assert'
import { describe, it } from 'node:test'
import { SourceRange, combineSourceRanges, getEmptySourceRange, getSourceRange } from '../src/range.js'

describe('ast/range.ts', () => {
  describe('getEmptySourceRange()', () => {
    it('should return a source range with zero length at the beginning of the file', () => {
      const range = getEmptySourceRange()
      assert.deepStrictEqual(range, { offset: 0, length: 0, line: 1, column: 1 })
    })
  })

  describe('getSourceRange()', () => {
    it('should extract source range from a token', () => {
      const token = { offset: 5, len: 3, line: 2, column: 10 } as any
      const range = getSourceRange(token)
      assert.deepStrictEqual(range, { offset: 5, length: 3, line: 2, column: 10 })
    })

    it('should include the file path from a token', () => {
      const token = { offset: 5, len: 3, line: 2, column: 10, filePath: 'track.cadence' } as any
      const range = getSourceRange(token)
      assert.deepStrictEqual(range, { offset: 5, length: 3, line: 2, column: 10, filePath: 'track.cadence' })
    })

    it('should extract source range from an AST node', () => {
      const node = { range: { offset: 8, length: 4, line: 3, column: 15 } } as any
      const range = getSourceRange(node)
      assert.deepStrictEqual(range, { offset: 8, length: 4, line: 3, column: 15 })
    })
  })

  describe('combineSourceRanges()', () => {
    it('should combine ranges of multiple items', () => {
      const item1 = { offset: 5, len: 3, line: 2, column: 10, filePath: 'track.cadence' } as any
      const item2 = { offset: 8, len: 4, line: 3, column: 15, filePath: 'track.cadence' } as any
      const item3 = { offset: 12, len: 2, line: 4, column: 5, filePath: 'track.cadence' } as any

      const combinedRange = combineSourceRanges(item1, item2, item3)
      assert.deepStrictEqual(combinedRange, { offset: 5, length: 9, line: 2, column: 10, filePath: 'track.cadence' })
    })

    it('should reject combining ranges from different files', () => {
      const item1 = { offset: 5, len: 3, line: 2, column: 10, filePath: 'track-a.cadence' } as any
      const item2 = { offset: 8, len: 4, line: 3, column: 15, filePath: 'track-b.cadence' } as any

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
      assert.deepStrictEqual(range1, range2)
    })

    it('should return false for different source ranges', () => {
      const range1: SourceRange = { offset: 5, length: 3, line: 2, column: 10, filePath: 'track.cadence' }
      const range2: SourceRange = { offset: 8, length: 4, line: 3, column: 15, filePath: 'track.cadence' }
      assert.notDeepStrictEqual(range1, range2)
    })

    it('should return false for ranges with different file paths', () => {
      const range1: SourceRange = { offset: 5, length: 3, line: 2, column: 10, filePath: 'track-a.cadence' }
      const range2: SourceRange = { offset: 5, length: 3, line: 2, column: 10, filePath: 'track-b.cadence' }
      assert.notDeepStrictEqual(range1, range2)
    })
  })
})
