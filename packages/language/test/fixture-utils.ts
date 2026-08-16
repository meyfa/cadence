import assert from 'node:assert'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { describe, test } from 'node:test'

export type FixtureCompute = (fixture: Pick<Fixture, 'name' | 'source'>) => object
export type FixturePostProcess = (json: string) => string

export interface FixtureOptions {
  readonly component: string
  readonly compute: FixtureCompute
  readonly postProcess?: FixturePostProcess
}

export interface Fixture {
  readonly name: string
  readonly source: string
  readonly expected: object
  readonly instructions: readonly FixtureInstruction[]
}

export interface FixtureInstruction {
  readonly type: string
  readonly argument?: object
}

const baseDirectory = new URL('../fixtures/', import.meta.url)

function shouldGenerateFixtures (component: string): boolean {
  const option = process.env.GENERATE_FIXTURES
  return option === component || option === 'all'
}

/**
 * Split the input into the plain source code and the test runner instructions.
 */
function parseInstructions (source: string): readonly FixtureInstruction[] {
  const instructions: FixtureInstruction[] = []

  for (const line of source.split('\n')) {
    const match = /^\/\/\s*test:([a-zA-Z0-9_-]+)\s*(.*)$/.exec(line)
    if (match == null) {
      continue
    }

    const [, type, argument] = match
    instructions.push({
      type,
      argument: argument.trim().length > 0 ? JSON.parse(argument) : undefined
    })
  }

  return instructions
}

function applyInstruction (object: object, instruction: FixtureInstruction): object {
  switch (instruction.type) {
    case 'get_property':
      assert.ok(Array.isArray(instruction.argument), 'get_property instruction requires an array argument')
      return getProperty(object, instruction.argument as readonly string[])

    default:
      assert.fail(`Unknown fixture instruction type: ${instruction.type}`)
  }
}

function getProperty (object: object, path: readonly string[]): object {
  let current: unknown = object

  for (const key of path) {
    assert.ok(typeof current === 'object' && current != null, `Cannot get property "${key}" of non-object value`)
    assert.ok(Object.hasOwn(current, key), `Property "${key}" does not exist on object`)
    current = (current as Record<string, unknown>)[key]
  }

  return current as object
}

const tags = Object.freeze({
  Map: '%Map%',
  Set: '%Set%'
})

function serializeOutput (result: object, instructions: readonly FixtureInstruction[]): string {
  let object = result
  for (const instruction of instructions) {
    object = applyInstruction(object, instruction)
  }

  const replacer = (key: string, value: unknown) => {
    if (value instanceof Map) {
      return { [tags.Map]: Array.from(value) }
    }

    if (value instanceof Set) {
      return { [tags.Set]: Array.from(value) }
    }

    return value
  }

  return JSON.stringify(object, replacer, 2)
}

function deserializeOutput (json: string): object {
  const reviver = (key: string, value: unknown) => {
    if (typeof value === 'object' && value != null) {
      const map = tags.Map in value ? value[tags.Map] : undefined
      if (Array.isArray(map)) {
        return new Map(map)
      }

      const set = tags.Set in value ? value[tags.Set] : undefined
      if (Array.isArray(set)) {
        return new Set(set)
      }
    }

    return value
  }

  return JSON.parse(json, reviver)
}

async function getFixtureNames (component: string): Promise<readonly string[]> {
  const directory = new URL(`${component}/`, baseDirectory)
  const fileNames = await readdir(directory, { recursive: true })

  const sourceFileNames = fileNames.filter((name) => name.endsWith('.cadence')).sort()
  const expectedFileNames = fileNames.filter((name) => name.endsWith('.json')).sort()

  if (!shouldGenerateFixtures(component)) {
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
  const instructions = parseInstructions(source)

  if (shouldGenerateFixtures(component)) {
    const result = options.compute({ name, source })

    let string = serializeOutput(result, instructions)
    if (options.postProcess != null) {
      string = options.postProcess(string)
    }
    string = string.trimEnd() + '\n'

    await writeFile(expectedPath, string, 'utf-8')
  }

  const expected = deserializeOutput(await readFile(expectedPath, 'utf-8'))

  return { name, source, expected, instructions }
}

export async function createFixtureTests (options: FixtureOptions): Promise<void> {
  const { component } = options

  describe('fixtures', async () => {
    const fixtureNames = await getFixtureNames(component)
    assert(fixtureNames.length > 0, `No fixtures found for component "${component}".`)

    for (const name of fixtureNames) {
      test(name, async () => {
        const fixture = await loadFixture(options, name)

        const result = options.compute(fixture)

        // Round-trip the result to remove non-serializable properties (like error stack traces)
        // before comparing to the fixture (which will not have those properties).
        const normalized = deserializeOutput(serializeOutput(result, fixture.instructions))

        assert.deepStrictEqual(normalized, fixture.expected)
      })
    }
  })
}

/**
 * Collapse "range" objects to a single line in the given JSON string.
 * This is used to make the expected output shorter and easier to read.
 */
export const collapseRanges: FixturePostProcess = (json) => {
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
