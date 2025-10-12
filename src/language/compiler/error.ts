import { LocationError } from '../error.js'
import type { SourceLocation } from '../location.js'

export class CompileError extends LocationError {
  constructor (message: string, location?: SourceLocation) {
    super(message, location)
    this.name = 'CompileError'
  }
}
