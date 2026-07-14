import type { SourceRange } from '@meyfa/cadence-ast'
import { areSourceRangesEqual } from '@meyfa/cadence-ast'
import { RangeError } from '../result/errors.ts'

export class CompileError extends RangeError {
  constructor (message: string, range?: SourceRange) {
    super(message, range)
    this.name = 'CompileError'
  }

  equals (other: unknown): boolean {
    if (!(other instanceof CompileError)) {
      return false
    }

    if (this.message !== other.message) {
      return false
    }

    if (this.range == null) {
      return other.range == null
    }

    return other.range != null && areSourceRangesEqual(this.range, other.range)
  }
}
