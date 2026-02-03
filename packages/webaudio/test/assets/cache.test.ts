import assert from 'node:assert'
import { describe, it } from 'node:test'
import { createAssetCache } from '../../src/assets/cache.js'

describe('assets/cache.ts', () => {
  it('returns nothing for missing keys', () => {
    const cache = createAssetCache<number>({ maxSize: 100, getSize: (v) => v })
    assert.strictEqual(cache.get('missing'), undefined)
  })

  it('stores and retrieves values', () => {
    const cache = createAssetCache<number>({ maxSize: 100, getSize: (v) => v })
    cache.set('a', 10)
    cache.set('b', 20)
    assert.strictEqual(cache.get('a'), 10)
    assert.strictEqual(cache.get('b'), 20)
  })

  it('evicts least recently used items when exceeding max size', () => {
    const cache = createAssetCache<number>({ maxSize: 30, getSize: (v) => v })
    cache.set('a', 10)
    cache.set('b', 15)
    cache.set('c', 10) // This should evict 'a' (total size would be 35)

    assert.strictEqual(cache.get('a'), undefined)
    assert.strictEqual(cache.get('b'), 15)
    assert.strictEqual(cache.get('c'), 10)

    // Access 'b' to make it most recently used
    assert.strictEqual(cache.get('b'), 15)

    cache.set('d', 10) // This should evict 'c' (total size would be 35)

    assert.strictEqual(cache.get('c'), undefined)
    assert.strictEqual(cache.get('b'), 15)
    assert.strictEqual(cache.get('d'), 10)
  })

  it('does not store items larger than max size', () => {
    const cache = createAssetCache<number>({ maxSize: 20, getSize: (v) => v })
    cache.set('a', 25) // Too large to store
    assert.strictEqual(cache.get('a'), undefined)

    cache.set('b', 15) // Should store
    assert.strictEqual(cache.get('b'), 15)
  })

  it('deletes existing value when updated with an oversize item', () => {
    const cache = createAssetCache<number>({ maxSize: 20, getSize: (v) => v })
    cache.set('a', 10)
    assert.strictEqual(cache.get('a'), 10)

    cache.set('a', 25) // Too large to store; should delete previous value
    assert.strictEqual(cache.get('a'), undefined)
  })

  it('replaces existing values without double-counting size', () => {
    const cache = createAssetCache<number>({ maxSize: 20, getSize: (v) => v })

    cache.set('a', 10)
    cache.set('b', 10)

    // Updating 'a' to a larger value should evict 'b' (the remaining LRU)
    // because we first delete 'a' (total becomes 10), then need +15 (would be 25).
    cache.set('a', 15)

    assert.strictEqual(cache.get('a'), 15)
    assert.strictEqual(cache.get('b'), undefined)
  })

  it('frees space for new entries when existing entries are shrunk', () => {
    const cache = createAssetCache<number>({ maxSize: 20, getSize: (v) => v })

    cache.set('a', 15)
    cache.set('b', 5)

    // Shrink 'a' so there is room for 'c' without evicting.
    cache.set('a', 10)
    cache.set('c', 5)

    assert.strictEqual(cache.get('a'), 10)
    assert.strictEqual(cache.get('b'), 5)
    assert.strictEqual(cache.get('c'), 5)
  })
})
