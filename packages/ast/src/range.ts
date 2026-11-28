export interface SourceRange {
  readonly offset: number
  readonly length: number
  readonly line: number
  readonly column: number
  readonly filePath?: string
}

export interface Locatable {
  readonly range: SourceRange
}

export function getEmptySourceRange (): SourceRange {
  return { offset: 0, length: 0, line: 1, column: 1 }
}

export function getSourceRange (item: Locatable): SourceRange {
  return item.range
}

export function combineSourceRanges (...items: Locatable[]): SourceRange {
  if (items.length === 0) {
    return getEmptySourceRange()
  }

  const ranges = items.map(getSourceRange)
  const first = ranges.reduce((min, range) => (range.offset < min.offset ? range : min), ranges[0])
  const end = Math.max(...ranges.map((range) => range.offset + range.length))
  const filePath = ranges[0].filePath

  if (ranges.some((range) => range.filePath !== filePath)) {
    throw new Error('Cannot combine source ranges from different files')
  }

  return {
    offset: first.offset,
    length: end - first.offset,

    // This assumes that smaller offset means smaller line/column.
    line: first.line,
    column: first.column,
    ...(filePath == null ? {} : { filePath })
  }
}

export function areSourceRangesEqual (a: SourceRange, b: SourceRange): boolean {
  return a.offset === b.offset &&
    a.length === b.length &&
    a.line === b.line &&
    a.column === b.column &&
    a.filePath === b.filePath
}
