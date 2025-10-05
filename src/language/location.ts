import type { Token } from 'leac'
import * as ast from './ast.js'

export interface Location {
  readonly offset: number
  readonly length: number
  readonly line: number
  readonly column: number
}

type Locatable = Token | ast.ASTNode

export function getEmptyLocation (): Location {
  return { offset: 0, length: 0, line: 1, column: 1 }
}

export function locate (item: Locatable): Location {
  if ('location' in item) {
    return item.location
  }

  return {
    offset: item.offset,
    length: item.len,
    line: item.line,
    column: item.column
  }
}

export function combineLocations (...items: Locatable[]): Location {
  if (items.length === 0) {
    return getEmptyLocation()
  }

  const locs = items.map(locate)
  const first = locs.reduce((min, loc) => (loc.offset < min.offset ? loc : min), locs[0])
  const end = Math.max(...locs.map((loc) => loc.offset + loc.length))

  return {
    offset: first.offset,
    length: end - first.offset,

    // This assumes that smaller offset means smaller line/column.
    line: first.line,
    column: first.column
  }
}
