export function getRangeAt (source: string, offset: number, length: number) {
  const lines = source.slice(0, offset).split(/(?:\r\n|\r|\n)/)

  return {
    offset,
    length,
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1
  }
}
