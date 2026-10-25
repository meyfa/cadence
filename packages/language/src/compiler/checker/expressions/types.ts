import type { Capabilities } from '../../../type-system/base/function.ts'
import type { CompileError } from '../../error.ts'

export interface Checked<TValue> {
  readonly errors: readonly CompileError[]
  readonly capabilities: Capabilities
  readonly result?: TValue
}
