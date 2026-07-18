import assert from 'node:assert'
import { describe, it } from 'node:test'
import { findUnusedVariables } from '../../src/unused-variable/operation.ts'
import { applySemanticOperationWithParser } from '../../src/utilities/operations.ts'
import { getCadenceParser, getRangeAt } from '../helpers.ts'

const cadenceParser = await getCadenceParser()

describe('unused-variable/operation.ts', () => {
  it('reports assignments that are never referenced', () => {
    const source = [
      'used = sample("/samples/used.wav")',
      'unused = sample("/samples/unused.wav")',
      '& track (120.bpm) {',
      '  & part intro (4.bars) {',
      '    & used << [x---]',
      '  }',
      '}',
      ''
    ].join('\n')

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findUnusedVariables, cadenceParser, source),
      [
        {
          name: 'unused',
          message: 'Unused variable "unused"',
          range: getRangeAt(source, source.indexOf('unused ='), 'unused'.length)
        }
      ]
    )
  })

  it('does not report emitted parts or buses as unused', () => {
    const source = [
      '& track (120.bpm) {',
      '  & part intro (4.bars) {',
      '  }',
      '}',
      '& mixer {',
      '  & bus drums {',
      '  }',
      '}',
      ''
    ].join('\n')

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findUnusedVariables, cadenceParser, source),
      []
    )
  })

  it('does not report exposed properties as unused', () => {
    const source = [
      '& mixer {',
      '  @foo = 42',
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
      '& track (120.bpm) {',
      '  & part intro (4.bars) {',
      '    & automate synth.gain as ~[hold(-60.db):3 lin(0.db):1]',
      '  }',
      '}',
      ''
    ].join('\n')

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findUnusedVariables, cadenceParser, source),
      []
    )
  })

  it('does not treat explicit bus namespace access as an assignment reference', () => {
    const source = [
      'foo = sample("...")',
      '& track (120.bpm) {',
      '  & part intro (4.bars) {',
      '    & automate bus.foo.gain as ~[hold(-60.db):3 lin(0.db):1]',
      '  }',
      '}',
      '& mixer {',
      '  & bus foo {}',
      '}',
      ''
    ].join('\n')

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findUnusedVariables, cadenceParser, source),
      [
        {
          name: 'foo',
          message: 'Unused variable "foo"',
          range: getRangeAt(source, source.indexOf('foo ='), 'foo'.length)
        }
      ]
    )
  })

  it('reports unused named imports', () => {
    const source = [
      'use "instruments" as instruments',
      'use "effects" as fx',
      '',
      '& mixer {',
      '  & bus drums {',
      '    & fx.gain(0.db)',
      '  }',
      '}',
      ''
    ].join('\n')

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findUnusedVariables, cadenceParser, source),
      [
        {
          name: 'instruments',
          message: 'Unused import "instruments"',
          range: getRangeAt(source, source.indexOf('as instruments') + 'as '.length, 'instruments'.length)
        }
      ]
    )
  })

  it('reports unused default imports', () => {
    const source = [
      'use "instruments" as *',
      'use "effects" as *',
      '',
      '& mixer {',
      '  & bus drums {',
      '    & gain(0.db)',
      '  }',
      '}',
      ''
    ].join('\n')

    assert.deepStrictEqual(
      applySemanticOperationWithParser(findUnusedVariables, cadenceParser, source),
      [
        {
          name: 'instruments',
          message: 'Unused import from "instruments"',
          range: getRangeAt(source, source.indexOf('as *') + 'as '.length, '*'.length)
        }
      ]
    )
  })
})
