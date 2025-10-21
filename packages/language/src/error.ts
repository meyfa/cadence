import type { SourceRange } from './range.js'

export function truncateString (str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }

  return str.slice(0, maxLength - 1) + '…'
}

export interface ErrorResult<TError> {
  readonly complete: false
  readonly error: TError
}

export interface SuccessResult<TValue> {
  readonly complete: true
  readonly value: TValue
}

export type Result<TValue, TError> = SuccessResult<TValue> | ErrorResult<TError>

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
