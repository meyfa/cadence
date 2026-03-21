import type { SourceRange } from '@ast/range.js'
import { RangeError } from '../error.js'

export class ParseError extends RangeError {
  constructor (message: string, range?: SourceRange) {
    super(message, range)
    this.name = 'ParseError'
  }
}
