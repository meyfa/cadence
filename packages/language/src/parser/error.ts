import { RangeError } from '../error.js'
import type { SourceRange } from '../range.js'

export class ParseError extends RangeError {
  constructor (message: string, range?: SourceRange) {
    super(message, range)
    this.name = 'ParseError'
  }
}
