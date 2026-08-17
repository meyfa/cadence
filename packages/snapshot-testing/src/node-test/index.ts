import assert from 'node:assert'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import { deserialize, serialize } from '../serialization/index.ts'
import type { Fixture, FixtureOptions } from '../types.ts'

const Messages = Object.freeze({
  OutdatedFixtures: 'Mismatch between source files and expected output files. Run the tests with GENERATE_FIXTURES=1 to generate the expected output.'
})

function ensureTrailingSlash (url: URL): URL {
  const urlString = url.toString()
  return urlString.endsWith('/') ? url : new URL(urlString + '/')
}

function replaceSuffix (input: string, originalSuffix: string, replacementSuffix: string): string {
  assert.ok(input.endsWith(originalSuffix))
  return input.slice(0, input.length - originalSuffix.length) + replacementSuffix
}

function shouldGenerateFixtures (): boolean {
  const option = process.env.GENERATE_FIXTURES
  return option != null && option.trim().length > 0
}

async function getFixtureNames (options: FixtureOptions): Promise<readonly string[]> {
  const fileNames = await readdir(options.directory, { recursive: true })

  const sourceFileNames = fileNames.filter((name) => name.endsWith(options.inputFileSuffix)).sort()
  const outputFileNames = fileNames.filter((name) => name.endsWith(options.outputFileSuffix)).sort()

  if (!shouldGenerateFixtures()) {
    const expectedOutputFileNames = sourceFileNames.map((name) => {
      return replaceSuffix(name, options.inputFileSuffix, options.outputFileSuffix)
    })
    assert.deepStrictEqual(outputFileNames, expectedOutputFileNames, Messages.OutdatedFixtures)
  }

  return Object.freeze(sourceFileNames)
}

async function loadFixture (options: FixtureOptions, name: string): Promise<Fixture> {
  const { directory } = options

  const sourcePath = new URL(name, directory)
  const expectedPath = new URL(replaceSuffix(name, options.inputFileSuffix, options.outputFileSuffix), directory)

  const source = await readFile(sourcePath, 'utf-8')
  const instructions = options.instructionExtractor?.(source) ?? []

  if (shouldGenerateFixtures()) {
    const result = options.compute({ name, source })

    let string = serialize(result, instructions)
    if (options.postProcess != null) {
      string = options.postProcess(string)
    }
    string = string.trimEnd() + '\n'

    await writeFile(expectedPath, string, 'utf-8')
  }

  const expected = deserialize(await readFile(expectedPath, 'utf-8'))

  return { name, source, expected, instructions }
}

export async function createFixtureTests (options: FixtureOptions): Promise<void> {
  const directory = ensureTrailingSlash(options.directory)
  const normalizedOptions = { ...options, directory }

  const fixtureNames = await getFixtureNames(normalizedOptions)
  assert(fixtureNames.length > 0, `No fixtures found in: ${directory}`)

  for (const name of fixtureNames) {
    test(name, async () => {
      const fixture = await loadFixture(normalizedOptions, name)

      const result = normalizedOptions.compute(fixture)

      // Round-trip the result to remove non-serializable properties (like error stack traces)
      // before comparing to the fixture (which will not have those properties).
      const normalized = deserialize(serialize(result, fixture.instructions))

      assert.deepStrictEqual(normalized, fixture.expected)
    })
  }
}
