import assert from 'node:assert'
import { describe, it } from 'node:test'
import { computeBaseModel } from '../../../src/model/analysis/base.js'
import { computeKnownValueModel } from '../../../src/model/analysis/known-values.js'
import { computeReferenceModel } from '../../../src/model/analysis/references.js'
import type { BaseModel, KnownValueModel, ReferenceModel } from '../../../src/model/model.js'
import { findIdentifierAt } from '../../../src/model/query.js'
import { textFromString } from '../../../src/utilities/text.js'
import { getCadenceParser } from '../../helpers.js'

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
      'use "patterns" as p',
      '',
      'kick = sample("/samples/kick.wav")',
      'snare = sample("/samples/snare.wav")',
      '',
      'track {',
      '  part intro {',
      '    kick << p.loop([x---])',
      '  }',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const aliasIdentifier = findIdentifierAt(model, source.indexOf('as p') + 'as '.length)
    assert.strictEqual(aliasIdentifier?.name, 'p')
    assert.deepStrictEqual(model.knownValues.get(aliasIdentifier.id), {
      moduleName: 'patterns'
    })

    const sampleIdentifier = findIdentifierAt(model, source.indexOf('sample("/samples/kick.wav")'))
    assert.strictEqual(sampleIdentifier?.name, 'sample')
    assert.deepStrictEqual(model.knownValues.get(sampleIdentifier.id), {
      moduleName: 'instruments',
      exportName: 'sample'
    })

    const pIdentifier = findIdentifierAt(model, source.indexOf('p.loop'))
    assert.strictEqual(pIdentifier?.name, 'p')
    assert.deepStrictEqual(model.knownValues.get(pIdentifier.id), {
      moduleName: 'patterns'
    })

    const loopIdentifier = findIdentifierAt(model, source.indexOf('loop([x---])'))
    assert.strictEqual(loopIdentifier?.name, 'loop')
    assert.deepStrictEqual(model.knownValues.get(loopIdentifier.id), {
      moduleName: 'patterns',
      exportName: 'loop'
    })
  })

  it('does not set known values for property names', () => {
    const source = [
      'use "effects" as *',
      '',
      'mixer {',
      '  bus main (gain: -3.db) {}',
      '}',
      ''
    ].join('\n')

    const model = analyzeSource(source)

    const gainProperty = findIdentifierAt(model, source.indexOf('gain:'))
    assert.strictEqual(gainProperty?.kind, 'PropertyName')
    assert.strictEqual(model.knownValues.get(gainProperty.id), undefined)
  })
})
