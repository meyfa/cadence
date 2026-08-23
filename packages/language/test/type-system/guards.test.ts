import assert from 'node:assert'
import { describe, it } from 'node:test'
import { NumberFacet } from '../../src/type-system/base/number.ts'
import { RecordFacet } from '../../src/type-system/base/record.ts'
import { StringFacet } from '../../src/type-system/base/string.ts'
import { makeFacetType, makeUnionType } from '../../src/type-system/factory.ts'
import { isFacet, isType } from '../../src/type-system/guards.ts'

describe('type-system/guards.ts', () => {
  describe('isFacet', () => {
    it('should return true for Facet', () => {
      assert.strictEqual(isFacet(NumberFacet), true)
      assert.strictEqual(isFacet(NumberFacet.with(undefined)), true)
      assert.strictEqual(isFacet(NumberFacet.with('hz')), true)
      assert.strictEqual(isFacet(StringFacet), true)
    })

    it('should return false for Type', () => {
      assert.strictEqual(isFacet(NumberFacet.type()), false)
      assert.strictEqual(isFacet(makeFacetType(NumberFacet, RecordFacet)), false)
      assert.strictEqual(isFacet(makeUnionType(NumberFacet.type(), RecordFacet.type())), false)
    })
  })

  describe('isType', () => {
    it('should return true for Type', () => {
      assert.strictEqual(isType(NumberFacet.type()), true)
      assert.strictEqual(isType(makeFacetType(NumberFacet, RecordFacet)), true)
      assert.strictEqual(isType(makeUnionType(NumberFacet.type(), RecordFacet.type())), true)
    })

    it('should return false for Facet', () => {
      assert.strictEqual(isType(NumberFacet), false)
      assert.strictEqual(isType(NumberFacet.with(undefined)), false)
      assert.strictEqual(isType(NumberFacet.with('hz')), false)
      assert.strictEqual(isType(StringFacet), false)
    })
  })
})
