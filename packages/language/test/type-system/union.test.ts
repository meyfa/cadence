import { describe, it } from 'node:test'
import assert from 'node:assert'
import { getPossibleTypeAtoms, computeTypeUnion } from '../../src/type-system/union.ts'
import { makeFacetType, makeUnionType } from '../../src/type-system/factory.ts'
import { NumberFacet } from '../../src/type-system/base/number.ts'
import { RecordFacet } from '../../src/type-system/base/record.ts'
import { StringFacet } from '../../src/type-system/base/string.ts'

describe('type-system/union.ts', () => {
  describe('getTypeAtoms()', () => {
    it('should return the type itself for a FacetType', () => {
      const facetType = makeFacetType(NumberFacet.with('hz'), RecordFacet.with({
        foo: StringFacet.type()
      }))

      const atoms = getPossibleTypeAtoms(facetType)
      assert.strictEqual(atoms.length, 1)
      assert.strictEqual(atoms[0], facetType)
    })

    it('should return the members for a UnionType', () => {
      const facetType1 = makeFacetType(NumberFacet.with('hz'), RecordFacet.with({
        foo: StringFacet.type()
      }))

      const facetType2 = makeFacetType(NumberFacet.with('khz'), RecordFacet.with({
        bar: StringFacet.type()
      }))

      const unionType = makeUnionType(facetType1, facetType2)

      const atoms = getPossibleTypeAtoms(unionType)
      assert.strictEqual(atoms.length, 2)
      assert.strictEqual(atoms[0], facetType1)
      assert.strictEqual(atoms[1], facetType2)
    })
  })

  describe('computeTypeUnion()', () => {
    it('should throw an error for an empty set of types', () => {
      assert.throws(() => computeTypeUnion([]), /Cannot compute union of an empty set of types/)
    })

    it('should return the single type for a single type', () => {
      const facetType = makeFacetType(NumberFacet.with('hz'), RecordFacet.with({
        foo: StringFacet.type()
      }))

      const facetTypeUnion = computeTypeUnion([facetType])
      assert.strictEqual(facetTypeUnion, facetType)
    })

    it('should return a union type for multiple facet types', () => {
      const facetType1 = makeFacetType(NumberFacet.with('hz'), RecordFacet.with({
        foo: StringFacet.type()
      }))

      const facetType2 = makeFacetType(NumberFacet.with('khz'), RecordFacet.with({
        bar: StringFacet.type()
      }))

      const unionType = computeTypeUnion([facetType1, facetType2])
      assert.strictEqual(unionType.kind, 'UnionType')
      assert.strictEqual(unionType.members.length, 2)
      assert.strictEqual(unionType.members[0], facetType1)
      assert.strictEqual(unionType.members[1], facetType2)
    })

    it('should remove duplicate types when computing the union', () => {
      const facetType1 = makeFacetType(NumberFacet.with('hz'), RecordFacet.with({
        foo: StringFacet.type()
      }))

      const facetType2 = StringFacet.type()
      const facetType3 = StringFacet.type()

      // duplicate of facetType1
      const facetType4 = makeFacetType(NumberFacet.with('hz'), RecordFacet.with({
        foo: StringFacet.type()
      }))

      const facetType5 = makeFacetType(StringFacet, RecordFacet.with({
        bar: NumberFacet.type()
      }))

      const unionType = computeTypeUnion([facetType1, facetType2, facetType3, facetType4, facetType5])
      assert.strictEqual(unionType.kind, 'UnionType')
      assert.strictEqual(unionType.members.length, 3)
      assert.strictEqual(unionType.members[0], facetType1)
      assert.strictEqual(unionType.members[1], facetType2)
      assert.strictEqual(unionType.members[2], facetType5)
    })

    it('should flatten nested union types', () => {
      const facetType1 = makeFacetType(NumberFacet.with('hz'), RecordFacet.with({
        foo: StringFacet.type()
      }))

      const facetType2 = StringFacet.type()

      // duplicate of facetType1
      const facetType3 = makeFacetType(NumberFacet.with('hz'), RecordFacet.with({
        foo: StringFacet.type()
      }))

      // Nested union with duplicates
      const nestedUnionType = makeUnionType(facetType1, facetType2, facetType3)
      assert.strictEqual(nestedUnionType.members.length, 3)

      const facetType4 = makeFacetType(StringFacet, RecordFacet.with({
        bar: NumberFacet.type()
      }))

      // duplicate of facetType2
      const facetType5 = StringFacet.type()

      // The input has multiple duplicates:
      // - facetType1 (nested) and facetType3 (nested) are duplicates
      // - facetType2 (nested) and facetType5 (top-level) are duplicates
      // - nestedUnionType also appears twice
      //
      // The expected output should have only unique types:
      // - facetType1
      // - facetType2
      // - facetType4

      const unionType = computeTypeUnion([nestedUnionType, facetType4, facetType5, nestedUnionType])

      assert.strictEqual(unionType.kind, 'UnionType')
      assert.strictEqual(unionType.members.length, 3)
      assert.strictEqual(unionType.members[0], facetType1)
      assert.strictEqual(unionType.members[1], facetType2)
      assert.strictEqual(unionType.members[2], facetType4)
    })

    it('should not flatten types that are strictly subtypes of each other', () => {
      const facetType1 = makeFacetType(StringFacet)
      const facetType2 = makeFacetType(StringFacet, RecordFacet.with({
        foo: NumberFacet.with(undefined).type()
      }))
      const facetType3 = makeFacetType(StringFacet, RecordFacet.with({
        foo: NumberFacet.with(undefined).type(),
        bar: StringFacet.type()
      }))

      const unionType = computeTypeUnion([facetType1, facetType2, facetType3])
      assert.strictEqual(unionType.kind, 'UnionType')
      assert.strictEqual(unionType.members.length, 3)
      assert.strictEqual(unionType.members[0], facetType1)
      assert.strictEqual(unionType.members[1], facetType2)
      assert.strictEqual(unionType.members[2], facetType3)
    })
  })
})
