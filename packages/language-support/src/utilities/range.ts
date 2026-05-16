export interface SourceRange {
  readonly offset: number
  readonly length: number
  readonly line: number
  readonly column: number
}

export function sameRange (a: SourceRange, b: SourceRange): boolean {
  return a.offset === b.offset && a.length === b.length
}
