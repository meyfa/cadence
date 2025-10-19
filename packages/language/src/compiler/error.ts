import { LocationError } from '../error.js'
import { areSourceLocationsEqual, type SourceLocation } from '../location.js'

export class CompileError extends LocationError {
  constructor (message: string, location?: SourceLocation) {
    super(message, location)
    this.name = 'CompileError'
  }

  equals (other: unknown): boolean {
    if (!(other instanceof CompileError)) {
      return false
    }

    if (this.message !== other.message) {
      return false
    }

    if (this.location == null) {
      return other.location == null
    }

    return other.location != null && areSourceLocationsEqual(this.location, other.location)
  }
}
