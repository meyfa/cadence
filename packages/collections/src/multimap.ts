/**
 * A data structure that maps keys to multiple values.
 * Uses identity comparison for values.
 */
export interface ReadonlyMultimap<K, V> {
  /**
   * Retrieves the values for the given key.
   *
   * @param key The key.
   * @returns The set of values for the key, or `undefined` if the key was not found.
   */
  get (key: K): ReadonlySet<V> | undefined

  /**
   * Returns an iterator over all keys in the multimap.
   *
   * @returns An iterator over all keys.
   */
  keys (): IterableIterator<K>

  /**
   * Returns an iterator over all values in the multimap.
   *
   * @returns An iterator over all values.
   */
  values (): IterableIterator<ReadonlySet<V>>

  /**
   * Returns an iterator over all entries in the multimap.
   *
   * @returns An iterator over all entries.
   */
  entries (): IterableIterator<[K, ReadonlySet<V>]>
}

export interface Multimap<K, V> extends ReadonlyMultimap<K, V> {
  /**
   * Adds one or more values for the given key.
   *
   * @param key The key.
   * @param values The values to add.
   */
  add (key: K, ...values: readonly V[]): void

  /**
   * Removes a value for the given key.
   *
   * @param key The key.
   * @param value The value to remove.
   * @returns `true` if the value was removed, `false` if the key or value was not found.
   */
  delete (key: K, value: V): boolean
}

export function createMultimap<K, V> (): Multimap<K, V> {
  return new MultimapImplementation<K, V>()
}

class MultimapImplementation<K, V> implements Multimap<K, V> {
  private readonly map = new Map<K, Set<V>>()

  add (key: K, ...values: readonly V[]): void {
    let set = this.map.get(key)
    if (set == null) {
      set = new Set<V>()
      this.map.set(key, set)
    }

    for (const value of values) {
      set.add(value)
    }
  }

  delete (key: K, value: V): boolean {
    const values = this.map.get(key)
    if (values == null) {
      return false
    }

    const removed = values.delete(value)

    if (values.size === 0) {
      this.map.delete(key)
    }

    return removed
  }

  get (key: K): ReadonlySet<V> | undefined {
    return this.map.get(key)
  }

  * keys (): IterableIterator<K> {
    yield* this.map.keys()
  }

  * values (): IterableIterator<ReadonlySet<V>> {
    yield* this.map.values()
  }

  * entries (): IterableIterator<[K, ReadonlySet<V>]> {
    yield* this.map.entries()
  }
}
