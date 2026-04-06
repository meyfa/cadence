import type { ModuleId } from '../modules/types.js'

export interface Problem {
  readonly moduleId: ModuleId
  readonly label: string
  readonly error: Error
}
