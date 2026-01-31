/**
 * A multimap implementation that maps keys to multiple values.
 * Uses identity comparison for values.
 */
export class Multimap<K, V> {
  private readonly map = new Map<K, Set<V>>()

  /**
   * Inserts a value for the given key.
   *
   * @param key The key.
   * @param value The value to insert.
   */
  public insert (key: K, value: V): void {
    let values = this.map.get(key)
    if (values == null) {
      values = new Set<V>()
      this.map.set(key, values)
    }
    values.add(value)
  }

  /**
   * Removes a value for the given key.
   *
   * @param key The key.
   * @param value The value to remove.
   * @returns `true` if the value was removed, `false` if the key or value was not found.
   */
  public remove (key: K, value: V): boolean {
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

  /**
   * Retrieves the values for the given key.
   * The returned value may or may not reflect subsequent changes to the multimap.
   *
   * @param key The key.
   * @returns The set of values for the key, or `undefined` if the key was not found.
   */
  public get (key: K): ReadonlySet<V> | undefined {
    return this.map.get(key)
  }

  /**
   * Returns an iterator over all values in the multimap.
   *
   * @returns An iterator over all values.
   */
  public* values (): IterableIterator<V> {
    for (const values of this.map.values()) {
      yield* values
    }
  }
}
