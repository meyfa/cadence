import assert from 'node:assert'
import { describe, it } from 'node:test'
import { getFacet } from '../../../src/compiler/checker/type-facets.ts'
import { NumberFacet } from '../../../src/type-system/base/number.ts'
import { StringFacet } from '../../../src/type-system/base/string.ts'
import { CurveFacet } from '../../../src/type-system/domain/curve.ts'
import { ParameterFacet } from '../../../src/type-system/domain/parameter.ts'

describe('compiler/checker/type-facets.ts', () => {
  describe('getFacet()', () => {
    it('should resolve known facets without generics', () => {
      assert.strictEqual(getFacet('string', undefined), StringFacet)
      assert.strictEqual(getFacet('number', undefined), NumberFacet.with(undefined))
    })

    it('should normalize syntax-unit generics to base units', () => {
      assert.strictEqual(getFacet('number', 'ms'), NumberFacet.with('s'))
      assert.strictEqual(getFacet('curve', 'bars'), CurveFacet.with('beats'))
      assert.strictEqual(getFacet('parameter', 'beat'), ParameterFacet.with('beats'))
    })

    it('should reject unsupported generics', () => {
      assert.strictEqual(getFacet('string', 's'), undefined)
      assert.strictEqual(getFacet('number', 'samples'), undefined)
    })

    it('should return undefined for unknown facets', () => {
      assert.strictEqual(getFacet('unknown', undefined), undefined)
    })
  })
})
