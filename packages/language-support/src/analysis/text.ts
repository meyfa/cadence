import type { SourceRange } from '../types.js'

export interface TextLine {
  readonly from: number
  readonly number: number
}

export interface TextLike {
  readonly length: number
  readonly sliceString: (from: number, to?: number) => string
  readonly lineAt: (position: number) => TextLine
}

export function textFromString (source: string): TextLike {
  const lineStarts = getLineStarts(source)

  return {
    length: source.length,
    sliceString: (from, to) => source.slice(from, to),
    lineAt: (position) => {
      if (position < 0 || position > source.length) {
        throw new RangeError(`Invalid position ${position} in document of length ${source.length}`)
      }

      const lineIndex = findLineIndex(lineStarts, position)
      return {
        from: lineStarts[lineIndex],
        number: lineIndex + 1
      }
    }
  }
}

export function toSourceRange (document: TextLike, from: number, to: number): SourceRange {
  const line = document.lineAt(from)

  return {
    offset: from,
    length: to - from,
    line: line.number,
    column: from - line.from + 1
  }
}

function getLineStarts (source: string): readonly number[] {
  const lineStarts = [0]

  for (let index = 0; index < source.length; ++index) {
    switch (source[index]) {
      case '\r': {
        if (source[index + 1] === '\n') {
          ++index
        }

        lineStarts.push(index + 1)
        break
      }

      case '\n': {
        lineStarts.push(index + 1)
        break
      }
    }
  }

  return lineStarts
}

function findLineIndex (lineStarts: readonly number[], position: number): number {
  let low = 0
  let high = lineStarts.length

  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2)

    if (lineStarts[middle] <= position) {
      low = middle
    } else {
      high = middle
    }
  }

  return low
}
