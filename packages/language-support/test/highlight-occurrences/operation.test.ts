import assert from 'node:assert'
import { describe, it } from 'node:test'
import { findHighlightedOccurrences } from '../../src/highlight-occurrences/operation.ts'
import { applySemanticOperationWithParser } from '../../src/utilities/operations.ts'
import { getCadenceParser, getRangeAt } from '../helpers.ts'

const cadenceParser = await getCadenceParser()

describe('highlight-occurrences/operation.ts', () => {
  it('returns definition and reference ranges for assignments', () => {
    const source = [
      'foo = sample("/samples/foo.wav")',
      'bar = foo',
      '& track (120.bpm) {',
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

  it('returns definition and reference ranges for emission assignments', () => {
    const source = [
      '& foo = mixer {}',
      'bar = foo',
      ''
    ].join('\n')

    const position = source.lastIndexOf('foo') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, position),
      [
        getRangeAt(source, source.indexOf('& foo =') + '& '.length, 'foo'.length),
        getRangeAt(source, source.indexOf('foo', source.indexOf('bar =')), 'foo'.length)
      ]
    )
  })

  it('normalizes explicit bus namespace references to the bus member range', () => {
    const source = [
      '& track (120.bpm) {',
      '  part foo {',
      '    automate bus.foo.gain as ~[hold(-60.db):3 lin(0.db):1]',
      '  }',
      '}',
      '& mixer {',
      '  bus foo {}',
      '}',
      ''
    ].join('\n')

    const position = source.indexOf('bus.foo.gain') + 'bus.'.length + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, position),
      [
        getRangeAt(source, source.indexOf('bus.foo.gain') + 'bus.'.length, 'foo'.length),
        getRangeAt(source, source.indexOf('bus foo') + 'bus '.length, 'foo'.length)
      ]
    )
  })

  it('does not highlight named argument keys', () => {
    const source = [
      'tempo = 128.bpm',
      '& track (tempo: 140.bpm) {}',
      ''
    ].join('\n')

    const position = source.indexOf('tempo:') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, position),
      []
    )
  })

  it('does not highlight member accesses', () => {
    const source = [
      'synth = sample("...")',
      '& track (120.bpm) {',
      '  part intro (4.bars) {',
      '    automate synth.gain as ~[hold(-60.db):3 lin(0.db):1]',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.indexOf('synth.gain') + 'synth.'.length + 1

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

  it('uses correct boundary for identifier lookup', () => {
    const source = [
      'foo = 42',
      'bar = foo // reference',
      ''
    ].join('\n')

    const beforeNamePosition = source.indexOf(' foo // reference')
    const startOfNamePosition = source.indexOf('foo // reference')
    const endOfNamePosition = source.indexOf('foo // reference') + 'foo'.length
    const afterNamePosition = source.indexOf('foo // reference') + 'foo'.length + 1

    const beforeName = applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, beforeNamePosition)
    const startOfName = applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, startOfNamePosition)
    const endOfName = applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, endOfNamePosition)
    const afterName = applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, afterNamePosition)

    assert.deepStrictEqual(beforeName.length, 0, 'before name')
    assert.deepStrictEqual(startOfName.length, 2, 'start of name')
    assert.deepStrictEqual(endOfName.length, 2, 'end of name')
    assert.deepStrictEqual(afterName.length, 0, 'after name')
  })

  it('returns the definition and reference also for incomplete syntax', () => {
    const source = [
      'foo = 42',
      'foo',
      ''
    ].join('\n')

    const position = source.lastIndexOf('foo') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, position),
      [
        getRangeAt(source, source.indexOf('foo ='), 'foo'.length),
        getRangeAt(source, source.lastIndexOf('foo'), 'foo'.length)
      ]
    )
  })

  it('highlights occurrences of a default-imported symbol', () => {
    const source = [
      'use "instruments" as *',
      'inst0 = sine(-6.db)',
      'inst1 = sine(-9.db)',
      ''
    ].join('\n')

    const position = source.indexOf('sine') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, position),
      [
        getRangeAt(source, source.indexOf('sine(-6.db)'), 'sine'.length),
        getRangeAt(source, source.indexOf('sine(-9.db)'), 'sine'.length)
      ]
    )
  })

  it('highlights only identical default-imported symbols', () => {
    const source = [
      'use "effects" as *',
      'foo = delay',
      'bar = reverb',
      'baz = delay',
      'qux = reverb',
      ''
    ].join('\n')

    const delayPosition = source.indexOf('delay') + 1
    const reverbPosition = source.indexOf('reverb') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, delayPosition),
      [
        getRangeAt(source, source.indexOf('delay'), 'delay'.length),
        getRangeAt(source, source.lastIndexOf('delay'), 'delay'.length)
      ]
    )

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findHighlightedOccurrences, cadenceParser, source, reverbPosition),
      [
        getRangeAt(source, source.indexOf('reverb'), 'reverb'.length),
        getRangeAt(source, source.lastIndexOf('reverb'), 'reverb'.length)
      ]
    )
  })
})
