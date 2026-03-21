import type { SourceRange } from '@ast/range.js'
import { RangeError } from '../error.js'

export class LexError extends RangeError {
  constructor (message: string, range?: SourceRange) {
    super(message, range)
    this.name = 'LexError'
  }
}
