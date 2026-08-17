import { getEmptySourceRange } from '@meyfa/cadence-ast'
import type { Token } from 'leac'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { lex } from '../../src/lexer/lexer.ts'
import { parse } from '../../src/parser/parser.ts'
import { collapseKey, fromLineComment, createFixtureTests } from '@meyfa/cadence-snapshot-testing'

/**
 * Lex the given string and return the resulting tokens. This assumes that the lexer
 * is implemented correctly.
 */
function lexSource (input: string, filePath?: string): Token[] {
  const result = lex(input, filePath)
  assert.ok(result.complete, result.complete ? undefined : result.error)

  return result.value
}

describe('parser/parser.ts', async () => {
  describe('fixtures', async () => {
    await createFixtureTests({
      directory: new URL('../../fixtures/parser/', import.meta.url),
      inputFileSuffix: '.cadence',
      outputFileSuffix: '.json',
      compute: (fixture) => {
        const tokens = lexSource(fixture.source, fixture.name)
        return parse(tokens)
      },
      postProcess: collapseKey('range'),
      instructionExtractor: fromLineComment
    })
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
