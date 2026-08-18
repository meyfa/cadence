import { buildParser } from '@lezer/generator'
import { highlightTree, tags as t, tagHighlighter } from '@lezer/highlight'
import { createFixtureTests, fromLineComment } from '@meyfa/cadence-snapshot-testing'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { cadenceParserConfig } from '../src/parser-metadata.ts'

const cadenceGrammar = await readFile(new URL('../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar).configure(cadenceParserConfig)

const tokenHighlighter = tagHighlighter([
  { tag: t.comment, class: 'comment' },
  { tag: t.keyword, class: 'keyword' },
  { tag: t.string, class: 'string' },
  { tag: t.special(t.string), class: 'pattern' },
  { tag: t.number, class: 'number' },
  { tag: t.definition(t.variableName), class: 'definition-variable' },
  { tag: t.variableName, class: 'variable' },
  { tag: t.definition(t.propertyName), class: 'definition-property' },
  { tag: t.propertyName, class: 'property' },
  { tag: t.typeName, class: 'type' },
  { tag: t.function(t.name), class: 'function' },
  { tag: t.definitionOperator, class: 'definition-operator' },
  { tag: t.operator, class: 'operator' },
  { tag: t.arithmeticOperator, class: 'arithmetic-operator' },
  { tag: t.separator, class: 'separator' },
  { tag: t.brace, class: 'brace' },
  { tag: t.paren, class: 'paren' }
])

interface HighlightSpan {
  readonly from: number
  readonly to: number
  readonly text: string
  readonly classes: string[]
}

function getHighlightSpans (source: string): readonly HighlightSpan[] {
  const tree = cadenceParser.parse(source)
  const spans: HighlightSpan[] = []

  highlightTree(tree, tokenHighlighter, (from, to, classes) => {
    spans.push({ from, to, text: source.slice(from, to), classes: classes.split(' ') })
  })

  return spans
}

describe('language-support.ts', () => {
  describe('fixtures', async () => {
    await createFixtureTests({
      directory: new URL('../fixtures/highlighting/', import.meta.url),
      inputFileSuffix: '.cadence',
      outputFileSuffix: '.json',
      compute: (fixture) => getHighlightSpans(fixture.source),
      serialization: {
        shouldCollapse: (key, value) => !Array.isArray(value)
      },
      instructionExtractor: fromLineComment
    })
  })

  it('terminates strings at LF and CR characters', () => {
    for (const source of ['s = "Hello,\nWorld"', 's = "Hello,\rWorld"']) {
      const spans = getHighlightSpans(source)
      const stringSpans = spans.filter((span) => span.classes.includes('string'))
      assert.strictEqual(stringSpans.length, 1)
      assert.strictEqual(stringSpans[0].text, '"Hello,')
    }
  })
})
