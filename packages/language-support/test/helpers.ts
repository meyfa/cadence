import { buildParser } from '@lezer/generator'
import type { LRParser } from '@lezer/lr'
import { readFile } from 'node:fs/promises'

export function getRangeAt (source: string, offset: number, length: number) {
  const lines = source.slice(0, offset).split(/(?:\r\n|\r|\n)/)

  return {
    offset,
    length,
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1
  }
}

export async function getCadenceParser (): Promise<LRParser> {
  const cadenceGrammar = await readFile(new URL('../src/cadence.grammar', import.meta.url), 'utf8')
  return buildParser(cadenceGrammar)
}
