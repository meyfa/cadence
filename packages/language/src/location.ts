import type { Token } from 'leac'
import * as ast from './parser/ast.js'

export interface SourceLocation {
  readonly offset: number
  readonly length: number
  readonly line: number
  readonly column: number
}

type Locatable = Token | ast.ASTNode

export function getEmptySourceLocation (): SourceLocation {
  return { offset: 0, length: 0, line: 1, column: 1 }
}

export function getSourceLocation (item: Locatable): SourceLocation {
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

export function combineSourceLocations (...items: Locatable[]): SourceLocation {
  if (items.length === 0) {
    return getEmptySourceLocation()
  }

  const locs = items.map(getSourceLocation)
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

export function areSourceLocationsEqual (a: SourceLocation, b: SourceLocation): boolean {
  return a.offset === b.offset && a.length === b.length && a.line === b.line && a.column === b.column
}
