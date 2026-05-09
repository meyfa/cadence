import { buildParser } from '@lezer/generator'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { getHoverInfo } from '../../src/hover/operation.js'
import { applySemanticOperationWithParser } from '../../src/operations.js'
import { getRangeAt } from '../helpers.js'

const cadenceGrammar = await readFile(new URL('../../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar)

describe('hover/operation.ts', () => {
  it('returns function docs for wildcard-imported symbols', () => {
    const source = [
      'use "patterns" as *',
      'track {',
      '  part main (8.bars) {',
      '    drum << loop([x:8])',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.indexOf('loop(') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, position),
      {
        range: getRangeAt(source, source.indexOf('loop('), 'loop'.length),
        title: 'loop(pattern: pattern, times?: number) -> pattern',
        summary: 'Repeats a pattern for a fixed number of cycles, or indefinitely when times is omitted.'
      }
    )
  })

  it('returns module docs for aliased imports', () => {
    const source = [
      'use "effects" as fx',
      'mixer {',
      '  bus drum_bus {',
      '    effect fx.delay(mix: 0.75, time: 0.5.beats, feedback: 0.6)',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.indexOf('fx.delay') + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, position),
      {
        range: getRangeAt(source, source.indexOf('fx.delay'), 'fx'.length),
        title: 'module effects',
        summary: 'Effect functions for shaping mixer bus audio.'
      }
    )
  })

  it('returns function docs for aliased module members', () => {
    const source = [
      'use "effects" as fx',
      'mixer {',
      '  bus drum_bus {',
      '    effect fx.delay(mix: 0.75, time: 0.5.beats, feedback: 0.6)',
      '    effect fx.reverb(mix: 0.3, decay: 1.s)',
      '  }',
      '}',
      ''
    ].join('\n')

    const delayPosition = source.indexOf('fx.delay') + 'fx.'.length + 1
    const reverbPosition = source.indexOf('fx.reverb') + 'fx.'.length + 1

    assert.deepStrictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, delayPosition),
      {
        range: getRangeAt(source, source.indexOf('delay('), 'delay'.length),
        title: 'delay(mix: number, time: number(beats) | number(s), feedback: number) -> effect',
        summary: 'Adds echoes with configurable mix, time, and feedback.'
      }
    )

    assert.deepStrictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, reverbPosition),
      {
        range: getRangeAt(source, source.indexOf('reverb('), 'reverb'.length),
        title: 'reverb(mix: number, decay: number(beats) | number(s)) -> effect',
        summary: 'Adds reverberation with configurable mix and decay.'
      }
    )
  })

  it('does not return docs for property names that only textually match wildcard imports', () => {
    const source = [
      'use "effects" as *',
      'mixer {',
      '  bus drum_bus {',
      '    effect delay(gain: 0.5)',
      '  }',
      '}',
      ''
    ].join('\n')

    const position = source.indexOf('gain:') + 1

    assert.strictEqual(
      applySemanticOperationWithParser(getHoverInfo, cadenceParser, source, position),
      undefined
    )
  })
})
