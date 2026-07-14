import type { SourceRange } from '@meyfa/cadence-ast'
import { RangeError } from '../result/errors.js'

export class ParseError extends RangeError {
  constructor (message: string, range?: SourceRange) {
    super(message, range)
    this.name = 'ParseError'
  }
}
