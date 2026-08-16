import { getEmptySourceRange } from '@meyfa/cadence-ast'
import type { Token } from 'leac'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { lex } from '../../src/lexer/lexer.ts'
import { parse } from '../../src/parser/parser.ts'
import { createFixtureTests } from '../fixture-utils.ts'

/**
 * Lex the given string and return the resulting tokens. This assumes that the lexer
 * is implemented correctly.
 */
function lexSource (input: string, filePath?: string): Token[] {
  const result = lex(input, filePath)
  assert.ok(result.complete, result.complete ? undefined : result.error)

  return result.value
}

/**
 * Collapse "range" objects to a single line in the given JSON string.
 * This is used to make the expected output shorter and easier to read.
 */
function postProcess (json: string): string {
  const inputLines: readonly string[] = json.split('\n')
  const outputLines: string[] = []

  for (let index = 0; index < inputLines.length; ++index) {
    const line = inputLines[index]

    if (!line.endsWith('"range": {')) {
      outputLines.push(line)
      continue
    }

    let endIndex = index + 1
    while (endIndex < inputLines.length && !/^ +[},]$/.test(inputLines[endIndex])) {
      ++endIndex
    }

    const begin = line
    const middle = inputLines.slice(index + 1, endIndex).map((line) => line.trim()).join(' ')
    const end = inputLines[endIndex].trim()

    outputLines.push(`${begin}${middle}${end}`)
    index = endIndex
  }

  return outputLines.join('\n')
}

describe('parser/parser.ts', async () => {
  await createFixtureTests({
    component: 'parser',
    compute: (fixture) => {
      const tokens = lexSource(fixture.source, fixture.name)
      return parse(tokens)
    },
    postProcess
  })

  it('should accept empty token array', () => {
    const result = parse([])

    assert.deepStrictEqual(result, {
      complete: true,
      value: {
        type: 'Program',
        imports: [],
        children: [],
        range: getEmptySourceRange()
      }
    })
  })
})
