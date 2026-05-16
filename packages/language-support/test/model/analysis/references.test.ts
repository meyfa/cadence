import assert from 'node:assert'
import { describe, it } from 'node:test'
import { computeBaseModel } from '../../../src/model/analysis/base.js'
import { computeReferenceModel } from '../../../src/model/analysis/references.js'
import type { BaseModel, ReferenceModel } from '../../../src/model/model.js'
import { textFromString } from '../../../src/utilities/text.js'
import { getCadenceParser, getRangeAt } from '../../helpers.js'

const cadenceParser = await getCadenceParser()

function analyzeSource (source: string): BaseModel & ReferenceModel {
  const tree = cadenceParser.parse(source)
  const document = textFromString(source)

  const base = computeBaseModel(tree, document)
  const references = computeReferenceModel(base)

  return { ...base, ...references }
}

describe('model/analysis/references.ts', () => {
  it('resolves definitions to themselves', () => {
    const source = [
      'kick = sample("/samples/kick.wav")',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const identifier = model.identifiers.find((identifier) => identifier.name === 'kick')
    assert.ok(identifier != null)

    const binding = model.identifierBindingMap.get(identifier.id)
    assert.ok(binding != null)
    assert.strictEqual(binding.kind, 'assignment')
    assert.strictEqual(binding.name, 'kick')
    assert.deepStrictEqual(binding.range, getRangeAt(source, source.indexOf('kick ='), 'kick'.length))

    const references = model.referenceMap.get(binding.id)
    assert.deepStrictEqual(references, [identifier])
  })

  it('resolves variables to their definition', () => {
    const source = [
      'kick = sample("/samples/kick.wav")',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    kick << [x---]',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const position = source.lastIndexOf('kick <<')
    const identifier = model.identifiers.find((identifier) => identifier.range.offset === position)
    assert.ok(identifier != null)

    const binding = model.identifierBindingMap.get(identifier.id)
    assert.ok(binding != null)
    assert.strictEqual(binding.kind, 'assignment')
    assert.strictEqual(binding.name, 'kick')
    assert.deepStrictEqual(binding.range, getRangeAt(source, source.indexOf('kick ='), 'kick'.length))

    const references = model.referenceMap.get(binding.id)
    assert.ok(references != null)
    assert.ok(references.includes(identifier))
  })

  it('resolves explicit bus namespace access to the bus binding', () => {
    const source = [
      'track (120.bpm) {',
      '  part foo (4.bars) {',
      '    automate bus.foo.gain as curve [hold(0.db)]',
      '  }',
      '}',
      'mixer {',
      '  bus foo {}',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const position = source.indexOf('bus.foo.gain') + 'bus.'.length
    const identifier = model.identifiers.find((identifier) => identifier.range.offset === position)
    assert.ok(identifier != null)

    const binding = model.identifierBindingMap.get(identifier.id)
    assert.ok(binding != null)
    assert.strictEqual(binding.kind, 'bus')
    assert.strictEqual(binding.name, 'foo')
    assert.deepStrictEqual(binding.range, getRangeAt(source, source.indexOf('bus foo') + 'bus '.length, 'foo'.length))

    const references = model.referenceMap.get(binding.id)
    assert.ok(references != null)
    assert.ok(references.includes(identifier))
  })

  it('does not resolve named argument keys', () => {
    const source = [
      'tempo = 128.bpm',
      'track (tempo: 140.bpm) {}',
      ''
    ].join('\n')

    const model = analyzeSource(source)
    const position = source.indexOf('tempo:')

    const identifier = model.identifiers.find((identifier) => identifier.range.offset === position)
    assert.ok(identifier != null)

    const binding = model.identifierBindingMap.get(identifier.id)
    assert.strictEqual(binding, undefined)
  })

  it('does not resolve member access', () => {
    const source = [
      'use "effects" as fx',
      'gain = 0.db',
      'synth = sample("...", gain: gain)',
      'track (120.bpm) {',
      '  part intro (4.bars) {',
      '    automate synth.gain as curve [hold(0.db)]',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)
    const position = source.indexOf('synth.gain') + 'synth.'.length

    const identifier = model.identifiers.find((identifier) => identifier.range.offset === position)
    assert.ok(identifier != null)

    const binding = model.identifierBindingMap.get(identifier.id)
    assert.strictEqual(binding, undefined)
  })

  it('does not resolve member access of an explicit bus access', () => {
    const source = [
      'track (120.bpm) {',
      '  part main (4.bars) {',
      '    automate bus.foo.gain as curve [hold(0.db)]',
      '  }',
      '}',
      'mixer {',
      '  bus foo {}',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)
    const position = source.indexOf('bus.foo.gain') + 'bus.foo.'.length

    const identifier = model.identifiers.find((identifier) => identifier.range.offset === position)
    assert.ok(identifier != null)

    const binding = model.identifierBindingMap.get(identifier.id)
    assert.strictEqual(binding, undefined)
  })

  it('prefers import aliases over assignments with the same name', () => {
    const source = [
      'fx = sample("/samples/fx.wav")',
      'use "effects" as fx',
      'fx.delay()',
      ''
    ].join('\n')

    const model = analyzeSource(source)
    const position = source.lastIndexOf('fx.delay')

    const identifier = model.identifiers.find((identifier) => identifier.range.offset === position)
    assert.ok(identifier != null)

    const binding = model.identifierBindingMap.get(identifier.id)
    assert.ok(binding != null)
    assert.strictEqual(binding.kind, 'use-alias')
    assert.strictEqual(binding.name, 'fx')
    assert.deepStrictEqual(binding.range, getRangeAt(source, source.indexOf('as fx') + 'as '.length, 'fx'.length))
  })
})
