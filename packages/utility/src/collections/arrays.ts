/**
 * Moves an item in an immutable array from one index to another, returning a new array.
 * If either index is out of bounds, the original array is returned.
 *
 * @param array The original array.
 * @param fromIndex The index of the item to move.
 * @param toIndex The index to move the item to.
 * @returns A new array with the item moved.
 */
export function move<T> (array: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
  if (fromIndex < 0 || fromIndex >= array.length || toIndex < 0 || toIndex >= array.length) {
    return array
  }

  const newArray = [...array]

  const [item] = newArray.splice(fromIndex, 1)
  newArray.splice(toIndex, 0, item)

  return newArray
}

/**
 * Inserts an item in an immutable array at the specified index, returning a new array.
 * If the index is out of bounds, it is clamped into the valid range.
 *
 * @param array The original array.
 * @param index The index to insert the item at.
 * @param item The item to insert.
 * @returns A new array with the item inserted.
 */
export function insertAt<T> (array: readonly T[], index: number, item: T): readonly T[] {
  const clampedIndex = Math.max(0, Math.min(array.length, index))

  return [
    ...array.slice(0, clampedIndex),
    item,
    ...array.slice(clampedIndex)
  ]
}

/**
 * Removes an item in an immutable array at the specified index, returning a new array.
 * If the index is out of bounds, the original array is returned.
 *
 * @param array The original array.
 * @param index The index of the item to remove.
 * @returns A new array with the item removed.
 */
export function removeAt<T> (array: readonly T[], index: number): readonly T[] {
  if (index < 0 || index >= array.length) {
    return array
  }

  return [
    ...array.slice(0, index),
    ...array.slice(index + 1)
  ]
}

type Comparator<T> = (a: T, b: T) => number

/**
 * Inserts an item into an array in sorted order according to the provided comparator.
 * The array is mutated in-place.
 *
 * @param array The array to insert into (must already be sorted according to the comparator).
 * @param item The item to insert.
 * @param comparator A function (a, b) that returns a negative number if a < b, zero if a == b, or a positive number if a > b.
 * @returns The array with the item inserted.
 */
export function insertSorted<T> (array: T[], item: T, comparator: Comparator<T>): void {
  // Fast path: append if the item is after all existing items.
  const last = array.at(-1)
  if (last == null || comparator(last, item) <= 0) {
    array.push(item)
    return
  }

  // Find the first index whose item is > the new item, to insert before it.
  let low = 0
  let high = array.length

  while (low < high) {
    const mid = (low + high) >>> 1
    if (comparator(array[mid], item) <= 0) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  array.splice(low, 0, item)
}
