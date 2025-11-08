import assert from 'node:assert'
import { describe, it } from 'node:test'
import { arrayInsert, arrayMove, arrayRemove } from '../../src/utilities/arrays.js'

describe('utilities/arrays.ts', () => {
  describe('arrayMove', () => {
    it('should move an item from one index to another', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(arrayMove(array, 0, 2), [2, 3, 1, 4, 5])
      assert.deepStrictEqual(arrayMove(array, 4, 1), [1, 5, 2, 3, 4])
      assert.deepStrictEqual(arrayMove(array, 2, 2), array)
    })

    it('should handle out-of-bounds indices gracefully', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(arrayMove(array, -1, 2), array)
      assert.deepStrictEqual(arrayMove(array, 10, 0), array)
      assert.deepStrictEqual(arrayMove(array, 0, -1), array)
      assert.deepStrictEqual(arrayMove(array, 0, 10), array)
    })
  })

  describe('arrayInsert', () => {
    it('should insert an item at the specified index', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(arrayInsert(array, 0, 0), [0, 1, 2, 3, 4, 5])
      assert.deepStrictEqual(arrayInsert(array, 3, 99), [1, 2, 3, 99, 4, 5])
      assert.deepStrictEqual(arrayInsert(array, 5, 6), [1, 2, 3, 4, 5, 6])
    })

    it('should handle out-of-bounds indices gracefully', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(arrayInsert(array, -1, 0), array)
      assert.deepStrictEqual(arrayInsert(array, 10, 6), array)
    })
  })

  describe('arrayRemove', () => {
    it('should remove the item at the specified index', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(arrayRemove(array, 0), [2, 3, 4, 5])
      assert.deepStrictEqual(arrayRemove(array, 2), [1, 2, 4, 5])
      assert.deepStrictEqual(arrayRemove(array, 4), [1, 2, 3, 4])
    })

    it('should handle out-of-bounds indices gracefully', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(arrayRemove(array, -1), array)
      assert.deepStrictEqual(arrayRemove(array, 10), array)
    })
  })
})
