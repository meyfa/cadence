import { getEmptySourceRange } from '@meyfa/cadence-ast'
import type { Token } from 'leac'
import assert from 'node:assert'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { describe, it, test } from 'node:test'
import { lex } from '../../src/lexer/lexer.ts'
import { parse } from '../../src/parser/parser.ts'

/**
 * Lex the given string and return the resulting tokens. This assumes that the lexer
 * is implemented correctly.
 */
function lexSource (input: string, filePath?: string): Token[] {
  const result = lex(input, filePath)
  assert.ok(result.complete, result.complete ? undefined : result.error)

  return result.value
}

const GENERATE_FIXTURES = process.env.GENERATE_FIXTURES === 'parser'

const FIXTURES_DIRECTORY = new URL('../fixtures/parser/', import.meta.url)

const FIXTURE_NAMES = await (async () => {
  const fileNames = await readdir(FIXTURES_DIRECTORY)

  const sourceFileNames = fileNames.filter((name) => name.endsWith('.cadence')).sort()
  const expectedFileNames = fileNames.filter((name) => name.endsWith('.json')).sort()

  if (!GENERATE_FIXTURES) {
    assert.deepStrictEqual(
      sourceFileNames.map((name) => name.replace(/\.cadence$/, '.json')),
      expectedFileNames,
      'Mismatch between source files and expected output files. Run the tests with GENERATE_FIXTURES=parser to generate the expected output.'
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
    const expected = parse(lexSource(source, name))
    const string = postProcess(JSON.stringify(expected, null, 2)) + '\n'
    await writeFile(expectedPath, string, 'utf-8')
  }

  const expected = JSON.parse(await readFile(expectedPath, 'utf-8'))

  return { name, source, expected }
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

describe('parser/parser.ts', () => {
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

  for (const fixtureName of FIXTURE_NAMES) {
    test(`fixture: ${fixtureName}`, async () => {
      const fixture = await loadFixture(fixtureName)
      const result = parse(lexSource(fixture.source, fixture.name))

      // Round-trip the result to remove non-serializable properties (like error stack traces)
      // before comparing to the fixture (which will not have those properties).
      const normalized = JSON.parse(JSON.stringify(result))
      assert.deepStrictEqual(normalized, fixture.expected)
    })
  }
})
