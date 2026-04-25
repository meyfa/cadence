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

export interface TextLine {
  readonly from: number
  readonly number: number
}

export interface TextLike {
  readonly length: number
  readonly sliceString: (from: number, to?: number) => string
  readonly lineAt: (position: number) => TextLine
}
