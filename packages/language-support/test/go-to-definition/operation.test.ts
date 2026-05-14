import { buildParser } from '@lezer/generator'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { goToDefinition } from '../../src/go-to-definition/operation.js'
import { applySemanticOperationWithParser } from '../../src/operations.js'
import { getRangeAt } from '../helpers.js'

const cadenceGrammar = await readFile(new URL('../../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar)

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
      'track (120.bpm) {',
      '  part foo {',
      '    automate bus.foo.gain as curve [hold(-60.db):3 lin(0.db):1]',
      '  }',
      '}',
      'mixer {',
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

  it('does not resolve named argument keys', () => {
    const source = [
      'tempo = 128.bpm',
      'track (tempo: 140.bpm) {}',
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
      'track (120.bpm) {',
      '  part p {',
      '    automate synth.gain as curve [hold(-60.db) lin(-60.db, 0.db)]',
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
