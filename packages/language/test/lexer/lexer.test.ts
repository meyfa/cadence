import type { Token } from 'leac'
import assert from 'node:assert'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { describe, it, test } from 'node:test'
import type { LexError } from '../../src/lexer/error.ts'
import type { LexResult } from '../../src/lexer/lexer.ts'
import { lex } from '../../src/lexer/lexer.ts'
import type { Result } from '../../src/result/result.ts'

type LexResultWithoutMeta = Result<ReadonlyArray<Omit<Token, 'state' | 'offset' | 'len' | 'line' | 'column'>>, LexError>

/**
 * Helper function to strip metadata such as the source range from tokens for easier comparison in tests.
 */
function stripTokenMeta (result: LexResult): LexResultWithoutMeta {
  // Testing that the lexer library produces correct ranges is out of scope.

  if (!result.complete) {
    return result
  }

  return {
    complete: true,
    value: result.value.map(({ name, text }) => ({ name, text }))
  }
}

const GENERATE_FIXTURES = process.env.GENERATE_FIXTURES === 'lexer'

const FIXTURES_DIRECTORY = new URL('../fixtures/lexer/', import.meta.url)

const FIXTURE_NAMES = await (async () => {
  const fileNames = await readdir(FIXTURES_DIRECTORY)

  const sourceFileNames = fileNames.filter((name) => name.endsWith('.cadence')).sort()
  const expectedFileNames = fileNames.filter((name) => name.endsWith('.json')).sort()

  if (!GENERATE_FIXTURES) {
    assert.deepStrictEqual(
      sourceFileNames.map((name) => name.replace(/\.cadence$/, '.json')),
      expectedFileNames,
      'Mismatch between source files and expected output files. Run the tests with GENERATE_FIXTURES=lexer to generate the expected output.'
    )
  }

  return Object.freeze(sourceFileNames)
})()

interface Fixture {
  readonly name: string
  readonly source: string
  readonly expected: object
}

async function loadFixture (name: string): Promise<Fixture> {
  const sourcePath = new URL(name, FIXTURES_DIRECTORY)
  const expectedPath = new URL(name.replace(/\.cadence$/, '.json'), FIXTURES_DIRECTORY)

  const source = await readFile(sourcePath, 'utf-8')

  if (GENERATE_FIXTURES) {
    const expected = stripTokenMeta(lex(source, name))
    const string = JSON.stringify(expected, null, 2) + '\n'
    await writeFile(expectedPath, string, 'utf-8')
  }

  const expected = JSON.parse(await readFile(expectedPath, 'utf-8'))

  return { name, source, expected }
}

describe('lexer/lexer.ts', () => {
  it('should accept empty input', () => {
    const result = lex('')
    assert.deepStrictEqual(stripTokenMeta(result), { complete: true, value: [] })
  })

  it('should handle invalid input', () => {
    const result = lex('foo = 42 $', 'track.cadence')
    assert.strictEqual(result.complete, false)
    assert.strictEqual(result.error.name, 'LexError')
    assert.strictEqual(result.error.message, 'Unexpected input "$"')
    assert.deepStrictEqual(result.error.range, { offset: 9, length: 1, line: 1, column: 10, filePath: 'track.cadence' })
    assert.strictEqual(result.error.range.filePath, 'track.cadence')
  })

  it('should fail to lex strings with LF and/or CR characters', () => {
    const lf = lex('"hello\nworld"')
    assert.strictEqual(lf.complete, false)
    assert.strictEqual(lf.error.name, 'LexError')
    assert.strictEqual(lf.error.message, 'Unexpected newline in string')
    assert.deepStrictEqual(lf.error.range, { offset: 6, length: 1, line: 1, column: 7, filePath: undefined })

    const cr = lex('"hello\rworld"')
    assert.strictEqual(cr.complete, false)
    assert.strictEqual(cr.error.name, 'LexError')
    assert.strictEqual(cr.error.message, 'Unexpected newline in string')
    assert.deepStrictEqual(cr.error.range, { offset: 6, length: 1, line: 1, column: 7, filePath: undefined })

    const crlf = lex('"hello\r\nworld"')
    assert.strictEqual(crlf.complete, false)
    assert.strictEqual(crlf.error.name, 'LexError')
    assert.strictEqual(crlf.error.message, 'Unexpected newline in string')
    assert.deepStrictEqual(crlf.error.range, { offset: 6, length: 2, line: 1, column: 7, filePath: undefined })
  })

  it('should annotate tokens with the source file path', () => {
    const result = lex('foo = 42', 'track.cadence')
    assert.strictEqual(result.complete, true)
    assert.strictEqual((result.value[0] as any)?.filePath, 'track.cadence')
  })

  for (const fixtureName of FIXTURE_NAMES) {
    test(`fixture: ${fixtureName}`, async () => {
      const fixture = await loadFixture(fixtureName)
      const result = stripTokenMeta(lex(fixture.source, fixture.name))

      // Round-trip the result to remove non-serializable properties (like error stack traces)
      // before comparing to the fixture (which will not have those properties).
      const normalized = JSON.parse(JSON.stringify(result))
      assert.deepStrictEqual(normalized, fixture.expected)
    })
  }
})
