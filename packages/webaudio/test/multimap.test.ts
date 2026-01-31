import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Multimap } from '../src/utilities/multimap.js'

describe('utilities/multimap.ts', () => {
  it('should insert and retrieve values', () => {
    const multimap = new Multimap<string, number>()
    multimap.insert('a', 1)
    multimap.insert('a', 2)
    multimap.insert('b', 3)

    const aValues = multimap.get('a')
    assert.ok(aValues)
    assert.deepStrictEqual(new Set(aValues), new Set([1, 2]))

    const bValues = multimap.get('b')
    assert.ok(bValues)
    assert.deepStrictEqual(new Set(bValues), new Set([3]))
  })

  it('should remove values', () => {
    const multimap = new Multimap<string, number>()
    multimap.insert('a', 1)
    multimap.insert('a', 2)
    multimap.insert('b', 3)

    multimap.remove('a', 1)
    let aValues = multimap.get('a')
    assert.ok(aValues)
    assert.deepStrictEqual(new Set(aValues), new Set([2]))

    multimap.remove('a', 2)
    aValues = multimap.get('a')
    assert.strictEqual(aValues, undefined)

    const bValues = multimap.get('b')
    assert.ok(bValues)
    assert.deepStrictEqual(new Set(bValues), new Set([3]))
  })

  it('should iterate over all values', () => {
    const multimap = new Multimap<string, number>()
    multimap.insert('a', 1)
    multimap.insert('a', 2)
    multimap.insert('b', 3)

    const allValues = Array.from(multimap.values())
    assert.deepStrictEqual(new Set(allValues), new Set([1, 2, 3]))
  })
})
