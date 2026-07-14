import type { SourceRange } from '../utilities/range.ts'
import type { BaseModel, Binding, Identifier, Import } from './model.ts'

export function findIdentifierAt (model: BaseModel, position: number): Identifier | undefined {
  return binarySearch(model.identifiers, position)
}

export function findBindingAt (model: BaseModel, position: number): Binding | undefined {
  return binarySearch(model.bindings, position)
}

export function findImportAt (model: BaseModel, position: number): Import | undefined {
  return binarySearch(model.imports, position)
}

function binarySearch<T extends { readonly range: SourceRange }> (items: readonly T[], position: number): T | undefined {
  let low = 0
  let high = items.length - 1

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const item = items[mid]
    const start = item.range.offset
    const end = start + item.range.length

    if (position < start) {
      high = mid - 1
    } else if (position > end) {
      low = mid + 1
    } else {
      return item
    }
  }

  return undefined
}
