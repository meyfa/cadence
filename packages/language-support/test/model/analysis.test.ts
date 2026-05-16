import assert from 'node:assert'
import { describe, it } from 'node:test'
import { analyzeTree } from '../../src/model/analysis.js'
import { textFromString } from '../../src/utilities/text.js'
import { getCadenceParser } from '../helpers.js'

const cadenceParser = await getCadenceParser()

describe('model/analysis.ts', () => {
  it('reuses the analyzed model for repeated lookups on the same tree and document', () => {
    const source = [
      'foo = 1',
      'bar = foo',
      ''
    ].join('\n')

    const tree = cadenceParser.parse(source)
    const document = textFromString(source)

    const firstModel = analyzeTree(tree, document)
    const secondModel = analyzeTree(tree, document)

    assert.strictEqual(secondModel, firstModel)
  })

  it('does not share models across different trees', () => {
    const source = [
      'foo = 1',
      'bar = foo',
      ''
    ].join('\n')

    const firstTree = cadenceParser.parse(source)
    const secondTree = cadenceParser.parse(source)
    const document = textFromString(source)

    const firstModel = analyzeTree(firstTree, document)
    const secondModel = analyzeTree(secondTree, document)

    assert.notStrictEqual(secondModel, firstModel)
  })
})
