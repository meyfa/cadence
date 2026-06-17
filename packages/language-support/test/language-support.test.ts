import { buildParser } from '@lezer/generator'
import { highlightTree, tags as t, tagHighlighter } from '@lezer/highlight'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { cadenceParserConfig } from '../src/parser-metadata.js'

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

function getHighlightSpans (source: string): HighlightSpan[] {
  const tree = cadenceParser.parse(source)
  const spans: HighlightSpan[] = []

  highlightTree(tree, tokenHighlighter, (from, to, classes) => {
    spans.push({ from, to, text: source.slice(from, to), classes: classes.split(' ') })
  })

  return spans
}

function assertHighlightAt (
  spans: readonly HighlightSpan[],
  source: string,
  text: string,
  start: number,
  tokenClass: string
): void {
  const span = spans.find((candidate) => candidate.from === start && candidate.to === start + text.length)

  const spanExpected = `Expected a highlight span for ${JSON.stringify(text)} at ${start} in ${JSON.stringify(source)}`
  assert.ok(span != null, spanExpected)

  assert.strictEqual(span.text, text)

  const classExpected = `Expected ${JSON.stringify(text)} at ${start} to include ${JSON.stringify(tokenClass)} in ${JSON.stringify(span)}`
  assert.ok(span.classes.includes(tokenClass), classExpected)
}

describe('language-support.ts', () => {
  it('highlights configured syntax categories', () => {
    const source = [
      '// comment',
      'use "std" as lib',
      'tempo = 128.bpm',
      'mix = 0.5 + 0.25',
      'pattern = [D4:2 - x]',
      'inst = sample("kick-{tempo}")',
      'track (tempo: 140.bpm) {',
      '  part drums {',
      '    automate lib.gain as ~[hold(-60.db) lin(-60.db, 0.db)]',
      '  }',
      '}',
      'mixer {',
      '  bus main {',
      '    inst',
      '    effect fx.pan(-1)',
      '  }',
      '}',
      ''
    ].join('\n')

    const spans = getHighlightSpans(source)

    const definitionInstrumentStart = source.indexOf('inst =')
    const useInstrumentStart = source.indexOf('    inst') + '    '.length

    assertHighlightAt(spans, source, '// comment', source.indexOf('// comment'), 'comment')
    assertHighlightAt(spans, source, 'use', source.indexOf('use'), 'keyword')
    assertHighlightAt(spans, source, 'track', source.indexOf('track'), 'keyword')
    assertHighlightAt(spans, source, '"std"', source.indexOf('"std"'), 'string')
    assertHighlightAt(spans, source, 'D4', source.indexOf('D4'), 'pattern')
    assertHighlightAt(spans, source, ' x', source.indexOf(' x]'), 'pattern')
    assertHighlightAt(spans, source, 'tempo', source.indexOf('tempo ='), 'definition-variable')
    assertHighlightAt(spans, source, 'mix', source.indexOf('mix ='), 'definition-variable')
    assertHighlightAt(spans, source, 'inst', definitionInstrumentStart, 'definition-variable')
    assertHighlightAt(spans, source, 'lib', source.indexOf('lib', source.indexOf('as lib')), 'definition-variable')
    assertHighlightAt(spans, source, 'tempo', source.indexOf('(tempo:') + 1, 'definition-property')
    assertHighlightAt(spans, source, 'gain', source.indexOf('.gain') + 1, 'property')
    assertHighlightAt(spans, source, 'sample', source.indexOf('sample("kick-'), 'function')
    assertHighlightAt(spans, source, 'hold', source.indexOf('hold('), 'function')
    assertHighlightAt(spans, source, 'pan', source.indexOf('.pan') + 1, 'function')
    assertHighlightAt(spans, source, '=', source.indexOf('='), 'definition-operator')
    assertHighlightAt(spans, source, '+', source.indexOf('+'), 'arithmetic-operator')
    assertHighlightAt(spans, source, '128', source.indexOf('128'), 'number')
    assertHighlightAt(spans, source, '0.5', source.indexOf('0.5'), 'number')
    assertHighlightAt(spans, source, '2', source.indexOf(':2') + 1, 'number')
    assertHighlightAt(spans, source, 'bpm', source.indexOf('bpm'), 'number')
    assertHighlightAt(spans, source, '{', source.indexOf('{'), 'brace')
    assertHighlightAt(spans, source, '(', source.indexOf('('), 'paren')
    assertHighlightAt(spans, source, ':', source.indexOf(':2'), 'separator')
    assertHighlightAt(spans, source, 'inst', useInstrumentStart, 'variable')
    assertHighlightAt(spans, source, 'fx', source.indexOf('fx.pan'), 'variable')
  })

  it('highlights routing operators and variable references', () => {
    const source = [
      'track {',
      '  part drums {',
      '    drums << my_pattern',
      '  }',
      '}',
      ''
    ].join('\n')

    const spans = getHighlightSpans(source)
    const definitionDrumsStart = source.indexOf('drums {')
    const routingDrumsStart = source.indexOf('drums <<')

    assertHighlightAt(spans, source, 'drums', definitionDrumsStart, 'definition-variable')
    assertHighlightAt(spans, source, 'drums', routingDrumsStart, 'variable')
    assertHighlightAt(spans, source, '<<', source.indexOf('<<'), 'operator')
    assertHighlightAt(spans, source, 'my_pattern', source.indexOf('my_pattern'), 'variable')
  })

  it('higlights units only when used as members', () => {
    const source = [
      'bpm = 120',
      'bars = 4',
      'part_length = 4.bars',
      'tempo = 120.bpm',
      'gain = 0.5.db',
      'delay = 250.ms'
    ].join('\n')

    const spans = getHighlightSpans(source)

    assertHighlightAt(spans, source, 'bpm', source.indexOf('bpm ='), 'definition-variable')
    assertHighlightAt(spans, source, 'bars', source.indexOf('bars ='), 'definition-variable')
    assertHighlightAt(spans, source, 'part_length', source.indexOf('part_length ='), 'definition-variable')
    assertHighlightAt(spans, source, 'tempo', source.indexOf('tempo ='), 'definition-variable')
    assertHighlightAt(spans, source, 'gain', source.indexOf('gain ='), 'definition-variable')
    assertHighlightAt(spans, source, 'delay', source.indexOf('delay ='), 'definition-variable')

    assertHighlightAt(spans, source, 'bars', source.indexOf('4.bars') + '4.'.length, 'number')
    assertHighlightAt(spans, source, 'bpm', source.indexOf('120.bpm') + '120.'.length, 'number')
    assertHighlightAt(spans, source, 'db', source.indexOf('0.5.db') + '0.5.'.length, 'number')
    assertHighlightAt(spans, source, 'ms', source.indexOf('250.ms') + '250.'.length, 'number')
  })
})
