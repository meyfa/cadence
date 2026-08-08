import assert from 'node:assert'
import { describe, it } from 'node:test'
import { setAll } from '../../src/collections/maps.ts'

describe('collections/maps.ts', () => {
  describe('setAll', () => {
    it('should insert all items from the source map into the target map', () => {
      const targetMap = new Map<string, number>([['a', 1], ['b', 2]])
      const sourceMap = new Map<string, number>([['b', 3], ['c', 4]])

      setAll(targetMap, sourceMap)

      assert.strictEqual(targetMap.size, 3)
      assert.strictEqual(targetMap.get('a'), 1)
      assert.strictEqual(targetMap.get('b'), 3) // Overwritten
      assert.strictEqual(targetMap.get('c'), 4)
    })

    it('should handle an empty source map gracefully', () => {
      const targetMap = new Map<string, number>([['a', 1], ['b', 2]])
      const sourceMap = new Map<string, number>()

      setAll(targetMap, sourceMap)

      assert.strictEqual(targetMap.size, 2)
      assert.strictEqual(targetMap.get('a'), 1)
      assert.strictEqual(targetMap.get('b'), 2)
    })

    it('should handle an empty target map gracefully', () => {
      const targetMap = new Map<string, number>()
      const sourceMap = new Map<string, number>([['a', 1], ['b', 2]])

      setAll(targetMap, sourceMap)

      assert.strictEqual(targetMap.size, 2)
      assert.strictEqual(targetMap.get('a'), 1)
      assert.strictEqual(targetMap.get('b'), 2)
    })
  })
})
