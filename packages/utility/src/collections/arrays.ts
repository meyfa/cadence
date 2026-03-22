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
