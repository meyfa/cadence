import { buildParser } from '@lezer/generator'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { getAnalysisModel } from '../../src/analysis/cache.js'
import { textFromString } from '../../src/analysis/text.js'

const cadenceGrammar = await readFile(new URL('../../src/cadence.grammar', import.meta.url), 'utf8')
const cadenceParser = buildParser(cadenceGrammar)

describe('analysis/cache.ts', () => {
  it('reuses the analyzed model for repeated lookups on the same tree and document', () => {
    const source = [
      'foo = 1',
      'bar = foo',
      ''
    ].join('\n')

    const tree = cadenceParser.parse(source)
    const document = textFromString(source)

    const firstModel = getAnalysisModel(tree, document)
    const secondModel = getAnalysisModel(tree, document)

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

    const firstModel = getAnalysisModel(firstTree, document)
    const secondModel = getAnalysisModel(secondTree, document)

    assert.notStrictEqual(secondModel, firstModel)
  })
})
