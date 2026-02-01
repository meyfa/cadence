import assert from 'node:assert'
import { describe, it } from 'node:test'
import { insertAt, move, removeAt } from '../src/arrays.js'

describe('arrays.ts', () => {
  describe('move', () => {
    it('should move an item from one index to another', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(move(array, 0, 2), [2, 3, 1, 4, 5])
      assert.deepStrictEqual(move(array, 4, 1), [1, 5, 2, 3, 4])
      assert.deepStrictEqual(move(array, 2, 2), array)
    })

    it('should handle out-of-bounds indices gracefully', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(move(array, -1, 2), array)
      assert.deepStrictEqual(move(array, 10, 0), array)
      assert.deepStrictEqual(move(array, 0, -1), array)
      assert.deepStrictEqual(move(array, 0, 10), array)
    })
  })

  describe('insertAt', () => {
    it('should insert an item at the specified index', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(insertAt(array, 0, 0), [0, 1, 2, 3, 4, 5])
      assert.deepStrictEqual(insertAt(array, 3, 99), [1, 2, 3, 99, 4, 5])
      assert.deepStrictEqual(insertAt(array, 5, 6), [1, 2, 3, 4, 5, 6])
    })

    it('should clamp out-of-bounds indices', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(insertAt(array, -1, 0), [0, 1, 2, 3, 4, 5])
      assert.deepStrictEqual(insertAt(array, 10, 6), [1, 2, 3, 4, 5, 6])
    })
  })

  describe('removeAt', () => {
    it('should remove the item at the specified index', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(removeAt(array, 0), [2, 3, 4, 5])
      assert.deepStrictEqual(removeAt(array, 2), [1, 2, 4, 5])
      assert.deepStrictEqual(removeAt(array, 4), [1, 2, 3, 4])
    })

    it('should handle out-of-bounds indices gracefully', () => {
      const array = [1, 2, 3, 4, 5]
      assert.deepStrictEqual(removeAt(array, -1), array)
      assert.deepStrictEqual(removeAt(array, 10), array)
    })
  })
})
