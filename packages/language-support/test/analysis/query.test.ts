import type { Tree } from '@lezer/common'
import { buildParser } from '@lezer/generator'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { analyzeTree } from '../../src/analysis/model.js'
import { findDefinitionBindingAt } from '../../src/analysis/query.js'
import { getRangeAt } from '../helpers.js'
import type { TextLike } from '../../src/analysis/text.js'
import { textFromString } from '../../src/analysis/text.js'

const cadenceGrammar = await readFile(new URL('../../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar)

function parseDocument (source: string): Readonly<{ tree: Tree, document: TextLike }> {
  return {
    tree: cadenceParser.parse(source),
    document: textFromString(source)
  }
}

describe('analysis/query.ts', () => {
  it('resolves assignment bindings from the shared analysis query', () => {
    const source = [
      'kick = sample("/samples/kick.wav")',
      'track (4.bars) {',
      '  part intro (4.bars) {',
      '    kick << [x---]',
      '  }',
      '}',
      ''
    ].join('\n')

    const { tree, document } = parseDocument(source)
    const model = analyzeTree(tree, document)
    const position = source.lastIndexOf('kick <<') + 1
    const binding = findDefinitionBindingAt(model, tree, document, position)

    assert.ok(binding)
    assert.strictEqual(binding.kind, 'assignment')
    assert.strictEqual(binding.name, 'kick')

    const kickOffset = source.indexOf('kick =')
    assert.deepStrictEqual(binding.range, getRangeAt(source, kickOffset, 'kick'.length))
  })

  it('resolves member access through the root identifier', () => {
    const source = [
      'use "effects" as fx',
      'synth = sample("...")',
      'track (4.bars) {',
      '  part intro (4.bars) {',
      '    automate synth.gain as curve [hold(-60.db):3 lin(0.db):1]',
      '  }',
      '}',
      ''
    ].join('\n')

    const { tree, document } = parseDocument(source)
    const model = analyzeTree(tree, document)
    const position = source.indexOf('synth.gain') + 'synth.'.length + 1
    const binding = findDefinitionBindingAt(model, tree, document, position)

    assert.ok(binding)
    assert.strictEqual(binding.kind, 'assignment')
    assert.strictEqual(binding.name, 'synth')

    const synthOffset = source.indexOf('synth =')
    assert.deepStrictEqual(binding.range, getRangeAt(source, synthOffset, 'synth'.length))
  })

  it('does not resolve named argument keys', () => {
    const source = [
      'tempo = 128.bpm',
      'track (tempo: 140.bpm) {}',
      ''
    ].join('\n')

    const { tree, document } = parseDocument(source)
    const model = analyzeTree(tree, document)
    const position = source.indexOf('tempo:') + 1

    assert.strictEqual(findDefinitionBindingAt(model, tree, document, position), undefined)
  })

  it('prefers import aliases over assignments with the same name', () => {
    const source = [
      'fx = sample("/samples/fx.wav")',
      'use "effects" as fx',
      'fx.delay()',
      ''
    ].join('\n')

    const { tree, document } = parseDocument(source)
    const model = analyzeTree(tree, document)
    const position = source.lastIndexOf('fx.delay') + 1
    const binding = findDefinitionBindingAt(model, tree, document, position)

    assert.ok(binding)
    assert.strictEqual(binding.kind, 'use-alias')
    assert.strictEqual(binding.name, 'fx')

    const aliasOffset = source.indexOf('use "effects" as fx') + 'use "effects" as '.length
    assert.deepStrictEqual(binding.range, getRangeAt(source, aliasOffset, 'fx'.length))
  })
})
