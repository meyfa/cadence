import type { SourceRange } from '@meyfa/cadence-ast'
import { RangeError, truncateString } from '../result/errors.ts'
import type { Token } from 'leac'

const errorContextLimit = 16

export class ParseError extends RangeError {
  constructor (message: string, range?: SourceRange) {
    super(message, range)
    this.name = 'ParseError'
  }
}

export function getErrorContext (token: Pick<Token, 'text'>): string {
  return truncateString(token.text, errorContextLimit)
}
