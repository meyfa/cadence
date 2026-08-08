interface MapSet<K, V> {
  set(key: K, value: V): void
}

/**
 * Insert all items from the source map into the target map. If a key already exists in the target map, it will be overwritten.
 *
 * @param map The target map to insert items into.
 * @param entries An iterable of key-value pairs to insert into the target map.
 */
export function setAll<K, V> (map: MapSet<K, V>, entries: Iterable<readonly [K, V]>): void {
  for (const [key, value] of entries) {
    map.set(key, value)
  }
}
