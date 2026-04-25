import type { ModuleId } from '../modules/types.js'

export type ProblemKind = 'error' | 'warning'

export interface ProblemInput {
  readonly kind: ProblemKind
  readonly label: string
  readonly message: string
  readonly error?: Error
}

export interface Problem {
  readonly moduleId: ModuleId
  readonly kind: ProblemKind
  readonly label: string
  readonly message: string
  readonly error?: Error
}
