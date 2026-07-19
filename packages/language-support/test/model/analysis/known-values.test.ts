import assert from 'node:assert'
import { describe, it } from 'node:test'
import { computeBaseModel } from '../../../src/model/analysis/base.ts'
import { computeKnownValueModel } from '../../../src/model/analysis/known-values.ts'
import { computeReferenceModel } from '../../../src/model/analysis/references.ts'
import type { BaseModel, KnownValueModel, ReferenceModel } from '../../../src/model/model.ts'
import { findIdentifierAt } from '../../../src/model/query.ts'
import { textFromString } from '../../../src/utilities/text.ts'
import { getCadenceParser } from '../../helpers.ts'

const cadenceParser = await getCadenceParser()

function analyzeSource (source: string): BaseModel & ReferenceModel & KnownValueModel {
  const tree = cadenceParser.parse(source)
  const document = textFromString(source)

  const base = computeBaseModel(tree, document)
  const references = computeReferenceModel(base)
  const knownValues = computeKnownValueModel(base, references)

  return { ...base, ...references, ...knownValues }
}

describe('model/analysis/known-values.ts', () => {
  it('resolves known values for identifiers', () => {
    const source = [
      'use "instruments" as *',
      'use "effects" as fx',
      '',
      'kick = sample("/samples/kick.wav")',
      'snare = sample("/samples/snare.wav")',
      '',
      '& mixer {',
      '  & bus {',
      '    & fx.gain(-3.db)',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const aliasIdentifier = findIdentifierAt(model, source.indexOf('as fx') + 'as '.length)
    assert.strictEqual(aliasIdentifier?.name, 'fx')
    assert.deepStrictEqual(model.knownValues.get(aliasIdentifier.id), {
      type: 'module',
      moduleName: 'effects'
    })

    const sampleIdentifier = findIdentifierAt(model, source.indexOf('sample("/samples/kick.wav")'))
    assert.strictEqual(sampleIdentifier?.name, 'sample')
    assert.deepStrictEqual(model.knownValues.get(sampleIdentifier.id), {
      type: 'module_value',
      moduleName: 'instruments',
      exportName: 'sample'
    })

    const fxIdentifier = findIdentifierAt(model, source.indexOf('fx.gain'))
    assert.strictEqual(fxIdentifier?.name, 'fx')
    assert.deepStrictEqual(model.knownValues.get(fxIdentifier.id), {
      type: 'module',
      moduleName: 'effects'
    })

    const gainIdentifier = findIdentifierAt(model, source.indexOf('gain(-3.db)'))
    assert.strictEqual(gainIdentifier?.name, 'gain')
    assert.deepStrictEqual(model.knownValues.get(gainIdentifier.id), {
      type: 'module_value',
      moduleName: 'effects',
      exportName: 'gain'
    })
  })

  it('does not set known values for argument names', () => {
    const source = [
      'use "effects" as *',
      '',
      '& mixer {',
      '  & bus main (gain: -3.db) {}',
      '}',
      '',
      // This is not valid, but sufficient for the test:
      // We want to ensure that built-in globals are not resolved for argument names, either.
      'foo = sample(play: "kick")',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const gainProperty = findIdentifierAt(model, source.indexOf('gain:'))
    assert.strictEqual(gainProperty?.kind, 'argument-name')
    assert.strictEqual(model.knownValues.get(gainProperty.id), undefined)

    const playProperty = findIdentifierAt(model, source.indexOf('play:'))
    assert.strictEqual(playProperty?.kind, 'argument-name')
    assert.strictEqual(model.knownValues.get(playProperty.id), undefined)
  })

  it('does not set known values for nested identifiers', () => {
    const source = [
      'use "effects" as fx',
      'foo = fx.pan.gain',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const panIdentifier = findIdentifierAt(model, source.indexOf('pan'))
    assert.strictEqual(panIdentifier?.name, 'pan')
    assert.deepStrictEqual(model.knownValues.get(panIdentifier.id), {
      type: 'module_value',
      moduleName: 'effects',
      exportName: 'pan'
    })

    // This test ensures that the resolution uses the previous sibling instead of
    // the access chain's root, which would incorrectly treat "fx.pan.gain" as "fx.gain".
    const gainIdentifier = findIdentifierAt(model, source.indexOf('gain'))
    assert.strictEqual(gainIdentifier?.name, 'gain')
    assert.strictEqual(model.knownValues.get(gainIdentifier.id), undefined)
  })

  it('resolves known values for global built-ins', () => {
    const source = [
      'play(kick, pattern)',
      'automate(kick.gain, curve)',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const playIdentifier = findIdentifierAt(model, source.indexOf('play('))
    assert.strictEqual(playIdentifier?.name, 'play')
    assert.deepStrictEqual(model.knownValues.get(playIdentifier.id), {
      type: 'global',
      name: 'play'
    })

    const automateIdentifier = findIdentifierAt(model, source.indexOf('automate('))
    assert.strictEqual(automateIdentifier?.name, 'automate')
    assert.deepStrictEqual(model.knownValues.get(automateIdentifier.id), {
      type: 'global',
      name: 'automate'
    })
  })
})
