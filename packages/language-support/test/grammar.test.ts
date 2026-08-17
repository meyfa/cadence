import type { TreeCursor } from '@lezer/common'
import { buildParser } from '@lezer/generator'
import { createFixtureTests, fromLineComment } from '@meyfa/cadence-snapshot-testing'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe } from 'node:test'
import { cadenceParserConfig } from '../src/parser-metadata.ts'

const cadenceGrammar = await readFile(new URL('../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar).configure(cadenceParserConfig)

interface SimplifiedNode {
  readonly text: string
  readonly type: string
  readonly children: readonly SimplifiedNode[]
}

function simplify (cursor: TreeCursor, source: string): SimplifiedNode {
  const node = cursor.node

  const children: SimplifiedNode[] = []

  if (cursor.firstChild()) {
    do {
      children.push(simplify(cursor, source))
    } while (cursor.nextSibling())

    assert.ok(cursor.parent())
  }

  return {
    text: source.slice(node.from, node.to),
    type: node.name,
    children
  }
}

describe('grammar.cadence', () => {
  describe('fixtures', async () => {
    await createFixtureTests({
      directory: new URL('../fixtures/grammar/', import.meta.url),
      inputFileSuffix: '.cadence',
      outputFileSuffix: '.json',

      compute: (fixture) => {
        const tree = cadenceParser.parse(fixture.source)
        return simplify(tree.cursor(), fixture.source)
      },

      instructionExtractor: fromLineComment
    })
  })
})
