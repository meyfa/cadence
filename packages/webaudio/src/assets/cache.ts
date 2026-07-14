import type { Numeric } from '@meyfa/cadence-utility'

export interface AssetCacheOptions<T> {
  readonly maxSize: Numeric<'bytes'>
  readonly getSize: (value: T) => Numeric<'bytes'>
}

export interface AssetCache<T> {
  readonly get: (key: string) => T | undefined
  readonly set: (key: string, value: T) => void
  readonly delete: (key: string) => void
}

interface CacheEntry<T> {
  readonly value: T
  readonly size: Numeric<'bytes'>
}

export function createAssetCache<T> (options: AssetCacheOptions<T>): AssetCache<T> {
  const cache = new Map<string, CacheEntry<T>>()
  let totalSize = 0

  const deleteKey = (key: string): void => {
    const existing = cache.get(key)
    if (existing != null) {
      cache.delete(key)
      totalSize -= existing.size
    }
  }

  const evictIfNeeded = (requiredSize: number): void => {
    while (totalSize + requiredSize > options.maxSize) {
      const oldestKey = cache.keys().next().value
      if (oldestKey == null) {
        break
      }
      deleteKey(oldestKey)
    }
  }

  return {
    get: (key: string) => {
      const entry = cache.get(key)
      if (entry != null) {
        // Move to the end to mark as most recently used.
        cache.delete(key)
        cache.set(key, entry)

        return entry.value
      }
    },

    set: (key: string, value: T) => {
      deleteKey(key)

      const size = options.getSize(value)
      if (size > options.maxSize) {
        return // too large to store
      }

      evictIfNeeded(size)

      cache.set(key, { value, size })
      totalSize += size
    },

    delete: deleteKey
  }
}
