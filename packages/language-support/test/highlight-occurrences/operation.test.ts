import { buildParser } from '@lezer/generator'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { findHighlightedOccurrences } from '../../src/highlight-occurrences/operation.js'
import { applySemanticOperationWithParser } from '../../src/operations.js'
import { getRangeAt } from '../helpers.js'

const cadenceGrammar = await readFile(new URL('../../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar)

describe('highlight-occurrences/operation.ts', () => {
  it('returns definition and reference ranges for assignments', () => {
    const source = [
      'foo = sample("/samples/foo.wav")',
      'bar = foo',
      'track (4.bars) {',
      '  part intro (4.bars) {',
      '    foo << [x---]',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.lastIndexOf('foo <<') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, position),
      [
        getRangeAt(source, source.indexOf('foo ='), 'foo'.length),
        getRangeAt(source, source.indexOf('foo', source.indexOf('bar =')), 'foo'.length),
        getRangeAt(source, source.lastIndexOf('foo <<'), 'foo'.length)
      ]
    )
  })

  it('normalizes member access references to the root identifier range', () => {
    const source = [
      'synth = sample("...")',
      'track (4.bars) {',
      '  part intro (4.bars) {',
      '    automate synth.gain as curve [hold(-60.db):3 lin(0.db):1]',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.indexOf('synth.gain') + 'synth.'.length + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, position),
      [
        getRangeAt(source, source.indexOf('synth ='), 'synth'.length),
        getRangeAt(source, source.indexOf('synth.gain'), 'synth'.length)
      ]
    )
  })

  it('does not highlight named argument keys', () => {
    const source = [
      'tempo = 128.bpm',
      'track (tempo: 140.bpm) {}',
      ''
    ].join('\n')

    const position = source.indexOf('tempo:') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, position),
      []
    )
  })

  it('returns the definition when no other references exist', () => {
    const source = [
      'lead = sample("...")',
      ''
    ].join('\n')

    const position = source.indexOf('lead =') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, position),
      [
        getRangeAt(source, source.indexOf('lead ='), 'lead'.length)
      ]
    )
  })
})
