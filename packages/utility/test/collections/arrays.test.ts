import assert from 'node:assert'
import { describe, it } from 'node:test'
import { insertAt, insertSorted, move, removeAt } from '../../src/collections/arrays.js'

describe('collections/arrays.ts', () => {
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

  describe('insertSorted', () => {
    it('should append to an empty array', () => {
      const array: number[] = []
      insertSorted(array, 5, (a, b) => a - b)
      assert.deepStrictEqual(array, [5])
    })

    it('should insert items in sorted order', () => {
      const array = [1, 3, 5]
      insertSorted(array, 0, (a, b) => a - b)
      assert.deepStrictEqual(array, [0, 1, 3, 5])
      insertSorted(array, 4, (a, b) => a - b)
      assert.deepStrictEqual(array, [0, 1, 3, 4, 5])
      insertSorted(array, 6, (a, b) => a - b)
      assert.deepStrictEqual(array, [0, 1, 3, 4, 5, 6])
    })

    it('should handle duplicate items', () => {
      const array = [1, 2, 2, 3]
      insertSorted(array, 2, (a, b) => a - b)
      assert.deepStrictEqual(array, [1, 2, 2, 2, 3])
    })

    it('should insert after all equal items', () => {
      const a = { value: 1 }
      const b = { value: 2 }
      const c = { value: 2 }
      const d = { value: 3 }
      const inserted = { value: 2 }
      const array = [a, b, c, d]
      insertSorted(array, inserted, (x, y) => x.value - y.value)
      assert.strictEqual(array[0], a)
      assert.strictEqual(array[1], b)
      assert.strictEqual(array[2], c)
      assert.strictEqual(array[3], inserted)
      assert.strictEqual(array[4], d)
    })
  })
})
