import assert from 'node:assert'
import { describe, it } from 'node:test'
import { analyzeSourceWithParser } from '../../src/model/analysis.ts'
import type { Model } from '../../src/model/model.ts'
import { textFromString } from '../../src/utilities/text.ts'
import { applySemanticOperation, applySemanticOperationWithParser } from '../../src/utilities/operations.ts'
import { getCadenceParser } from '../helpers.ts'

const cadenceParser = await getCadenceParser()

describe('utilities/operations.ts', () => {
  const countIdentifiers = (model: Model): number => model.identifiers.length

  const source = [
    'foo = 1',
    'bar = foo',
    ''
  ].join('\n')

  const expectedIdentifierCount = 3

  describe('applySemanticOperation()', () => {
    it('analyzes the given tree and document, then runs the operation on the resulting model', () => {
      const tree = cadenceParser.parse(source)
      const document = textFromString(source)

      const result = applySemanticOperation(countIdentifiers, tree, document)

      assert.strictEqual(result, expectedIdentifierCount)
    })

    it('forwards additional arguments to the operation', () => {
      const tree = cadenceParser.parse(source)
      const document = textFromString(source)

      const identifierAt = (model: Model, index: number) => model.identifiers[index]

      const result = applySemanticOperation(identifierAt, tree, document, 0)

      const expected = analyzeSourceWithParser(cadenceParser, source).identifiers[0]
      assert.deepStrictEqual(result, expected)
    })
  })

  describe('applySemanticOperationWithParser()', () => {
    it('parses the given source, then runs the operation on the resulting model', () => {
      const result = applySemanticOperationWithParser(countIdentifiers, cadenceParser, source)

      assert.strictEqual(result, expectedIdentifierCount)
    })

    it('forwards additional arguments to the operation', () => {
      const identifierAt = (model: Model, index: number) => model.identifiers[index]

      const result = applySemanticOperationWithParser(identifierAt, cadenceParser, source, 1)

      const expected = analyzeSourceWithParser(cadenceParser, source).identifiers[1]
      assert.deepStrictEqual(result, expected)
    })
  })
})
