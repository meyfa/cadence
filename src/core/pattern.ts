import type { Pattern, Step } from './program.js'

export function withPatternLength (pattern: Pattern, length: number): Pattern {
  const len = Math.floor(length)
  if (!Number.isSafeInteger(len) || len <= 0) {
    return []
  }

  if (pattern.length === len) {
    return pattern
  }

  if (pattern.length === 0) {
    return getSilentPattern(len)
  }

  const repeats = Math.ceil(len / pattern.length)
  return new Array<Pattern>(repeats).fill(pattern).flat().slice(0, len)
}

export function getSilentPattern (length: number): Pattern {
  const len = Math.floor(length)
  if (!Number.isSafeInteger(len) || len <= 0) {
    return []
  }

  return new Array<Step>(len).fill('rest')
}
