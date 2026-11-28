import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createMultimap } from '../../src/collections/multimap.ts'

describe('collections/multimap.ts', () => {
  it('should add and retrieve values', () => {
    const multimap = createMultimap<string, number>()
    multimap.add('a', 1)
    multimap.add('a', 2)
    multimap.add('b', 3)

    const aValues = multimap.get('a')
    assert.ok(aValues)
    assert.deepStrictEqual(new Set(aValues), new Set([1, 2]))

    const bValues = multimap.get('b')
    assert.ok(bValues)
    assert.deepStrictEqual(new Set(bValues), new Set([3]))
  })

  it('should add multiple values at once', () => {
    const multimap = createMultimap<string, number>()
    multimap.add('a', 1)
    multimap.add('a', 2, 3, 4)

    const aValues = multimap.get('a')
    assert.ok(aValues)
    assert.deepStrictEqual(new Set(aValues), new Set([1, 2, 3, 4]))
  })

  it('should delete values', () => {
    const multimap = createMultimap<string, number>()
    multimap.add('a', 1)
    multimap.add('a', 2)
    multimap.add('b', 3)

    multimap.delete('a', 1)
    let aValues = multimap.get('a')
    assert.ok(aValues)
    assert.deepStrictEqual(new Set(aValues), new Set([2]))

    multimap.delete('a', 2)
    aValues = multimap.get('a')
    assert.strictEqual(aValues, undefined)

    const bValues = multimap.get('b')
    assert.ok(bValues)
    assert.deepStrictEqual(new Set(bValues), new Set([3]))
  })

  it('should return whether values were deleted', () => {
    const multimap = createMultimap<string, number>()
    multimap.add('foo', 42)
    multimap.add('foo', 43)
    multimap.add('bar', 100)

    assert.strictEqual(multimap.delete('baz', 100), false)
    assert.strictEqual(multimap.delete('foo', 40), false)
    assert.strictEqual(multimap.delete('foo', 42), true)
    assert.strictEqual(multimap.delete('foo', 43), true)
    assert.strictEqual(multimap.delete('foo', 43), false)
  })

  it('should iterate over all keys', () => {
    const multimap = createMultimap<string, number>()
    multimap.add('a', 1)
    multimap.add('a', 2)
    multimap.add('b', 3)

    const allKeys = Array.from(multimap.keys())
    assert.deepStrictEqual(new Set(allKeys), new Set(['a', 'b']))
  })

  it('should iterate over all values', () => {
    const multimap = createMultimap<string, number>()
    multimap.add('a', 1)
    multimap.add('a', 2)
    multimap.add('b', 3)

    const allValues = Array.from(multimap.values())
    assert.deepStrictEqual(allValues, [new Set([1, 2]), new Set([3])])
  })

  it('should iterate over all entries', () => {
    const multimap = createMultimap<string, number>()
    multimap.add('a', 1)
    multimap.add('a', 2)
    multimap.add('b', 3)

    const allEntries = Array.from(multimap.entries())
    const expectedEntries = [
      ['a', new Set([1, 2])],
      ['b', new Set([3])]
    ]
    assert.deepStrictEqual(allEntries, expectedEntries)
  })
})
