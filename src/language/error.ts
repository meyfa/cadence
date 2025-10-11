import type { Location } from './location.js'

export class ParseError extends Error {
  location?: Location

  constructor (message: string, location?: Location) {
    super(message)
    this.name = 'ParseError'
    this.location = location
  }
}

export function truncateString (str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str
  }

  return str.slice(0, maxLength - 1) + '…'
}
