import { LocationError } from '../error.js'
import type { SourceLocation } from '../location.js'

export class LexError extends LocationError {
  constructor (message: string, location?: SourceLocation) {
    super(message, location)
    this.name = 'LexError'
  }
}
