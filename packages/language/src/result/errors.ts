import type { SourceRange } from '@ast'

export class CompoundError<TError extends Error> extends Error {
  readonly errors: readonly TError[]

  constructor (message: string, errors: readonly TError[]) {
    super(message)
    this.name = 'CompoundError'
    this.errors = errors
  }
}

export abstract class RangeError extends Error {
  readonly range?: SourceRange

  constructor (message: string, range?: SourceRange) {
    super(message)
    this.name = 'RangeError'
    this.range = range
  }
}

export function truncateString (str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }

  return str.slice(0, maxLength - 1) + '…'
}
