import type { SourceRange } from '@meyfa/cadence-ast'
import { RangeError } from '../result/errors.ts'

export class ParseError extends RangeError {
  constructor (message: string, range?: SourceRange) {
    super(message, range)
    this.name = 'ParseError'
  }
}
