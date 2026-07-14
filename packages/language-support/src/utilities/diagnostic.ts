import type { SourceRange } from './range.ts'

export interface LanguageDiagnostic {
  readonly name: string
  readonly message: string
  readonly range: SourceRange
}
