import type { Location } from './location.js'

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

export type Result<TValue, TError> = ErrorResult<TError> | SuccessResult<TValue>

export class CompoundError<TError extends Error> extends Error {
  readonly errors: readonly TError[]

  constructor (message: string, errors: readonly TError[]) {
    super(message)
    this.name = 'CompoundError'
    this.errors = errors
  }
}

export class ParseError extends Error {
  location?: Location

  constructor (message: string, location?: Location) {
    super(message)
    this.name = 'ParseError'
    this.location = location
  }
}

export class CompileError extends Error {
  location?: Location

  constructor (message: string, location?: Location) {
    super(message)
    this.name = 'CompileError'
    this.location = location
  }
}
