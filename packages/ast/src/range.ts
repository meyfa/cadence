import * as ast from './ast.js'

interface Token {
  readonly offset: number
  readonly len: number
  readonly line: number
  readonly column: number
}

export interface SourceRange {
  readonly offset: number
  readonly length: number
  readonly line: number
  readonly column: number
}

type Locatable = Token | ast.ASTNode

export function getEmptySourceRange (): SourceRange {
  return { offset: 0, length: 0, line: 1, column: 1 }
}

export function getSourceRange (item: Locatable): SourceRange {
  if ('range' in item) {
    return item.range
  }

  return {
    offset: item.offset,
    length: item.len,
    line: item.line,
    column: item.column
  }
}

export function combineSourceRanges (...items: Locatable[]): SourceRange {
  if (items.length === 0) {
    return getEmptySourceRange()
  }

  const ranges = items.map(getSourceRange)
  const first = ranges.reduce((min, range) => (range.offset < min.offset ? range : min), ranges[0])
  const end = Math.max(...ranges.map((range) => range.offset + range.length))

  return {
    offset: first.offset,
    length: end - first.offset,

    // This assumes that smaller offset means smaller line/column.
    line: first.line,
    column: first.column
  }
}

export function areSourceRangesEqual (a: SourceRange, b: SourceRange): boolean {
  return a.offset === b.offset && a.length === b.length && a.line === b.line && a.column === b.column
}
