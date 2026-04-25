import { buildParser } from '@lezer/generator'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { applySemanticOperationWithParser } from '../../src/operations.js'
import { findUnusedVariables } from '../../src/unused-variable/operation.js'
import { getRangeAt } from '../helpers.js'

const cadenceGrammar = await readFile(new URL('../../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar)

describe('unused-variable/operation.ts', () => {
  it('reports assignments that are never referenced', () => {
    const source = [
      'used = sample("/samples/used.wav")',
      'unused = sample("/samples/unused.wav")',
      'track (4.bars) {',
      '  part intro (4.bars) {',
      '    used << [x---]',
      '  }',
      '}',
      ''
    ].join('\n')

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findUnusedVariables, cadenceParser, source),
      [
        {
          name: 'unused',
          message: 'Unused variable "unused".',
          range: getRangeAt(source, source.indexOf('unused ='), 'unused'.length)
        }
      ]
    )
  })

  it('does not report parts or buses as unused', () => {
    const source = [
      'track (4.bars) {',
      '  part intro (4.bars) {',
      '  }',
      '}',
      'mixer {',
      '  bus drums {',
      '  }',
      '}',
      ''
    ].join('\n')

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findUnusedVariables, cadenceParser, source),
      []
    )
  })

  it('treats member access roots as references', () => {
    const source = [
      'synth = sample("...")',
      'track (4.bars) {',
      '  part intro (4.bars) {',
      '    automate synth.gain as curve [hold(-60.db):3 lin(0.db):1]',
      '  }',
      '}',
      ''
    ].join('\n')

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findUnusedVariables, cadenceParser, source),
      []
    )
  })
})
