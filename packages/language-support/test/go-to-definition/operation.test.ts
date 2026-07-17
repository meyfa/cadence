import assert from 'node:assert'
import { describe, it } from 'node:test'
import { goToDefinition } from '../../src/go-to-definition/operation.ts'
import { applySemanticOperationWithParser } from '../../src/utilities/operations.ts'
import { getCadenceParser, getRangeAt } from '../helpers.ts'

const cadenceParser = await getCadenceParser()

describe('go-to-definition/operation.ts', () => {
  it('resolves assignment references', () => {
    const source = [
      'foo = 1',
      'bar = foo',
      ''
    ].join('\n')

    const defPos = source.indexOf('foo =')
    const refPos = source.lastIndexOf('foo')

    const result = applySemanticOperationWithParser(goToDefinition, cadenceParser, source, refPos)

    assert.deepStrictEqual(result?.identifier.range, getRangeAt(source, refPos, 'foo'.length))
    assert.deepStrictEqual(result.binding.range, getRangeAt(source, defPos, 'foo'.length))
  })

  it('resolves bus references inside mixer', () => {
    const source = 'mixer { bus a { } bus b { a } }'

    const defPos = source.indexOf('bus a') + 'bus '.length

    const refPosLeft = source.lastIndexOf(' a ') + 1
    const refPosRight = source.lastIndexOf(' a ') + 2

    const identifierRange = getRangeAt(source, refPosLeft, 'a'.length)
    const bindingRange = getRangeAt(source, defPos, 'a'.length)

    for (const refPos of [refPosLeft, refPosRight]) {
      const result = applySemanticOperationWithParser(goToDefinition, cadenceParser, source, refPos)

      assert.deepStrictEqual(result?.identifier.range, identifierRange)
      assert.deepStrictEqual(result.binding.range, bindingRange)
    }
  })

  it('resolves import alias usage', () => {
    const source = [
      'use "std" as lib',
      'lib.foo()',
      ''
    ].join('\n')

    const defPos = source.indexOf('as lib') + 'as '.length
    const refPos = source.indexOf('lib.foo')

    const result = applySemanticOperationWithParser(goToDefinition, cadenceParser, source, refPos)

    assert.deepStrictEqual(result?.identifier.range, getRangeAt(source, refPos, 'lib'.length))
    assert.deepStrictEqual(result.binding.range, getRangeAt(source, defPos, 'lib'.length))
  })

  it('tolerates incomplete input', () => {
    const source = 'mixer { bus a { } bus b { a '

    const defPos = source.indexOf('bus a') + 'bus '.length
    const refPos = source.lastIndexOf('a')

    const result = applySemanticOperationWithParser(goToDefinition, cadenceParser, source, refPos)

    assert.deepStrictEqual(result?.identifier.range, getRangeAt(source, refPos, 'a'.length))
    assert.deepStrictEqual(result.binding.range, getRangeAt(source, defPos, 'a'.length))
  })

  it('resolves explicit bus namespace access to the bus definition', () => {
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

    const defPos = source.indexOf('bus foo') + 'bus '.length
    const refPos = source.indexOf('bus.foo.gain') + 'bus.'.length

    const result = applySemanticOperationWithParser(goToDefinition, cadenceParser, source, refPos)

    assert.deepStrictEqual(result?.identifier.range, getRangeAt(source, refPos, 'foo'.length))
    assert.deepStrictEqual(result.binding.range, getRangeAt(source, defPos, 'foo'.length))
  })

  it('resolves explicit bus namespace effect access to the effect definition', () => {
    const source = [
      'use "effects" as fx',
      '& track (120.bpm) {',
      '  part foo {',
      '    automate bus.main.lp.frequency as ~[lin(100.hz, 4000.hz)]',
      '  }',
      '}',
      '& mixer {',
      '  bus main {',
      '    effect lp = fx.lowpass(1000.hz)',
      '  }',
      '}',
      ''
    ].join('\n')

    const defPos = source.indexOf('effect lp') + 'effect '.length
    const refPos = source.indexOf('bus.main.lp.frequency') + 'bus.main.'.length

    const result = applySemanticOperationWithParser(goToDefinition, cadenceParser, source, refPos)

    assert.deepStrictEqual(result?.identifier.range, getRangeAt(source, refPos, 'lp'.length))
    assert.deepStrictEqual(result.binding.range, getRangeAt(source, defPos, 'lp'.length))
  })

  it('does not resolve named argument keys', () => {
    const source = [
      'tempo = 128.bpm',
      '& track (tempo: 140.bpm) {}',
      ''
    ].join('\n')

    const pos = source.indexOf('tempo:')

    const result = applySemanticOperationWithParser(goToDefinition, cadenceParser, source, pos)
    assert.strictEqual(result, undefined)
  })

  it('does not resolve member access', () => {
    const source = [
      'use "foo" as gain',
      '',
      'synth = sample("...")',
      '',
      '& track (120.bpm) {',
      '  part p {',
      '    automate synth.gain as ~[hold(-60.db) lin(-60.db, 0.db)]',
      '  }',
      '}',
      ''
    ].join('\n')

    const refPos = source.indexOf('synth.gain') + 'synth.'.length

    const result = applySemanticOperationWithParser(goToDefinition, cadenceParser, source, refPos)
    assert.strictEqual(result, undefined)
  })

  it('resolves incomplete syntax referring to an assignment', () => {
    const source = [
      'foo = 42',
      'foo',
      ''
    ].join('\n')

    const defPos = source.indexOf('foo =')
    const refPos = source.lastIndexOf('foo')

    const result = applySemanticOperationWithParser(goToDefinition, cadenceParser, source, refPos)

    assert.deepStrictEqual(result?.identifier.range, getRangeAt(source, refPos, 'foo'.length))
    assert.deepStrictEqual(result.binding.range, getRangeAt(source, defPos, 'foo'.length))
  })
})
