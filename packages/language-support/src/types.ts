export interface SourceRange {
  readonly offset: number
  readonly length: number
  readonly line: number
  readonly column: number
}

export interface LanguageDiagnostic {
  readonly name: string
  readonly message: string
  readonly range: SourceRange
}
