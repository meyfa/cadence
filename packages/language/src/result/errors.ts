import type { SourceRange } from '@meyfa/cadence-ast'

export class CompoundError<TError extends Error> extends Error {
  readonly errors: readonly TError[]

  constructor (message: string, errors: readonly TError[]) {
    super(message)
    this.name = 'CompoundError'
    this.errors = errors
  }

  toJSON (): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      errors: this.errors
    }
  }
}

export abstract class RangeError extends Error {
  readonly range?: SourceRange

  constructor (message: string, range?: SourceRange) {
    super(message)
    this.name = 'RangeError'
    this.range = range
  }

  toJSON (): Record<string, unknown> {
    const json: Record<string, unknown> = {
      name: this.name,
      message: this.message
    }

    if (this.range != null) {
      json.range = this.range
    }

    return json
  }
}

export function truncateString (str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }

  return str.slice(0, maxLength - 1) + '…'
}
