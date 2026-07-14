import assert from 'node:assert'
import { describe, it } from 'node:test'
import { sameRange } from '../../src/utilities/range.ts'

describe('utilities/range.ts', () => {
  describe('sameRange()', () => {
    it('returns true for ranges with the same offset and length', () => {
      const rangeA = { offset: 5, length: 10, line: 1, column: 6 }
      const rangeB = { offset: 5, length: 10, line: 2, column: 3 }

      assert.strictEqual(sameRange(rangeA, rangeB), true)
    })

    it('returns false for ranges with different offsets', () => {
      const rangeA = { offset: 5, length: 10, line: 1, column: 6 }
      const rangeB = { offset: 6, length: 10, line: 1, column: 6 }

      assert.strictEqual(sameRange(rangeA, rangeB), false)
    })

    it('returns false for ranges with different lengths', () => {
      const rangeA = { offset: 5, length: 10, line: 1, column: 6 }
      const rangeB = { offset: 5, length: 11, line: 1, column: 6 }

      assert.strictEqual(sameRange(rangeA, rangeB), false)
    })
  })
})
