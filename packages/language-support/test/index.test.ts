import assert from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { buildParser } from '@lezer/generator'
import { goToDefinitionWithParser } from '../src/go-to-definition.js'

const cadenceGrammar = await readFile(new URL('../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar)

describe('go-to-definition.ts', () => {
  it('resolves assignment references', () => {
    const source = [
      'foo = 1',
      'bar = foo',
      ''
    ].join('\n')

    const refPos = source.lastIndexOf('foo') + 1
    const def = goToDefinitionWithParser(cadenceParser, source, refPos)
    assert.ok(def)

    const defFrom = source.indexOf('foo')
    assert.strictEqual(def.from, defFrom)
    assert.strictEqual(def.to, defFrom + 'foo'.length)
    assert.strictEqual(def.name, 'foo')
  })

  it('resolves bus references inside mixer', () => {
    const source = 'mixer { bus a { } bus b { a } }'

    const refPos = source.lastIndexOf(' a ') + 2
    const def = goToDefinitionWithParser(cadenceParser, source, refPos)
    assert.ok(def)

    const defFrom = source.indexOf('bus a') + 'bus '.length
    assert.strictEqual(def.from, defFrom)
    assert.strictEqual(def.to, defFrom + 1)
    assert.strictEqual(def.name, 'a')
  })

  it('resolves import alias usage', () => {
    const source = [
      'use "std" as lib',
      'lib.foo()',
      ''
    ].join('\n')

    const refPos = source.indexOf('lib.foo') + 1
    const def = goToDefinitionWithParser(cadenceParser, source, refPos)
    assert.ok(def)

    const defFrom = source.indexOf('as lib') + 'as '.length
    assert.strictEqual(def.from, defFrom)
    assert.strictEqual(def.to, defFrom + 'lib'.length)
    assert.strictEqual(def.name, 'lib')
  })

  it('tolerates incomplete input', () => {
    const source = 'mixer { bus a { } bus b { a '

    const refPos = source.lastIndexOf('a') + 1
    const def = goToDefinitionWithParser(cadenceParser, source, refPos)
    assert.ok(def)

    const defFrom = source.indexOf('bus a') + 'bus '.length
    assert.strictEqual(def.from, defFrom)
    assert.strictEqual(def.to, defFrom + 1)
    assert.strictEqual(def.name, 'a')
  })

  it('does not resolve member access by member name', () => {
    const source = [
      'use "foo" as gain',
      '',
      'synth = sample("...")',
      '',
      'track {',
      '  part p {',
      '    automate synth.gain as curve [hold(-60.db) lin(-60.db, 0.db)]',
      '  }',
      '}',
      ''
    ].join('\n')

    const pos = source.indexOf('synth.gain') + 'synth.'.length + 1
    const def = goToDefinitionWithParser(cadenceParser, source, pos)
    assert.ok(def)

    const synthFrom = source.indexOf('\nsynth =') + 1
    assert.strictEqual(def.from, synthFrom)
    assert.strictEqual(def.to, synthFrom + 'synth'.length)
    assert.strictEqual(def.name, 'synth')
  })

  it('does not resolve named argument keys', () => {
    const source = [
      'tempo = 128.bpm',
      'track (tempo: 140.bpm) {}',
      ''
    ].join('\n')

    const pos = source.indexOf('tempo:') + 1
    const def = goToDefinitionWithParser(cadenceParser, source, pos)
    assert.strictEqual(def, undefined)
  })
})
