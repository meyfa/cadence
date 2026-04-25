export type ProblemKind = 'error' | 'warning'

export interface ProblemRange {
  readonly offset: number
  readonly length: number
  readonly line: number
  readonly column: number
  readonly filePath?: string
}

export interface Problem {
  readonly kind: ProblemKind
  readonly label: string
  readonly message: string
  readonly range?: ProblemRange
  readonly error?: Error
}
