export function arrayMove<T> (array: readonly T[], fromIndex: number, toIndex: number): readonly T[] {
  if (fromIndex < 0 || fromIndex >= array.length || toIndex < 0 || toIndex >= array.length) {
    return array
  }

  const newArray = [...array]

  const [item] = newArray.splice(fromIndex, 1)
  newArray.splice(toIndex, 0, item)

  return newArray
}

export function arrayInsert<T> (array: readonly T[], index: number, item: T): readonly T[] {
  if (index < 0 || index > array.length) {
    return array
  }

  return [
    ...array.slice(0, index),
    item,
    ...array.slice(index)
  ]
}

export function arrayRemove<T> (array: readonly T[], index: number): readonly T[] {
  if (index < 0 || index >= array.length) {
    return array
  }

  return [
    ...array.slice(0, index),
    ...array.slice(index + 1)
  ]
}
