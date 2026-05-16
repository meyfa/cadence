import type { SourceRange } from './range.js'

export interface LanguageDiagnostic {
  readonly name: string
  readonly message: string
  readonly range: SourceRange
}
