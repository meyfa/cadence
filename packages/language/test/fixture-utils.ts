import assert from 'node:assert'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { describe, test } from 'node:test'

export interface FixtureOptions {
  readonly component: string
  readonly compute: (fixture: Omit<Fixture, 'expected'>) => object
  readonly postProcess?: (json: string) => string
}

export interface Fixture {
  readonly name: string
  readonly source: string
  readonly expected: object
}

const generateOption = process.env.GENERATE_FIXTURES
const baseDirectory = new URL('../fixtures/', import.meta.url)

async function getFixtureNames (component: string): Promise<readonly string[]> {
  const directory = new URL(`${component}/`, baseDirectory)
  const fileNames = await readdir(directory)

  const sourceFileNames = fileNames.filter((name) => name.endsWith('.cadence')).sort()
  const expectedFileNames = fileNames.filter((name) => name.endsWith('.json')).sort()

  if (generateOption !== component) {
    assert.deepStrictEqual(
      sourceFileNames.map((name) => name.replace(/\.cadence$/, '.json')),
      expectedFileNames,
      `Mismatch between source files and expected output files. Run the tests with GENERATE_FIXTURES=${component} to generate the expected output.`
    )
  }

  return Object.freeze(sourceFileNames)
}

async function loadFixture (options: FixtureOptions, name: string): Promise<Fixture> {
  const { component } = options

  const sourcePath = new URL(`${component}/${name}`, baseDirectory)
  const expectedPath = new URL(`${component}/${name.replace(/\.cadence$/, '.json')}`, baseDirectory)

  const source = await readFile(sourcePath, 'utf-8')

  if (generateOption === component) {
    const result = options.compute({ name, source })

    let string = JSON.stringify(result, null, 2)
    if (options.postProcess != null) {
      string = options.postProcess(string)
    }
    string = string.trimEnd() + '\n'

    await writeFile(expectedPath, string, 'utf-8')
  }

  const expected = JSON.parse(await readFile(expectedPath, 'utf-8'))

  return { name, source, expected }
}

export async function createFixtureTests (options: FixtureOptions): Promise<void> {
  const { component } = options

  describe('fixtures', async () => {
    const fixtureNames = await getFixtureNames(component)

    for (const name of fixtureNames) {
      test(name, async () => {
        const fixture = await loadFixture(options, name)

        const result = options.compute(fixture)

        // Round-trip the result to remove non-serializable properties (like error stack traces)
        // before comparing to the fixture (which will not have those properties).
        const normalized = JSON.parse(JSON.stringify(result))

        assert.deepStrictEqual(normalized, fixture.expected)
      })
    }
  })
}
