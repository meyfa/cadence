import type { RuntimeNumeric, Unit } from '@utility'
import { runtimeNumeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { makeFacet, makeType, makeUnion } from '../../src/type-system/factory.js'
import type { DataForFacet, DataForFacets, Value, ValueForType } from '../../src/type-system/types.js'
import { expectTypeEquals } from '../test-utils.js'

const stringFacet = makeFacet<'string', string>('string', {})
const numberFacet = makeFacet<'number', number>('number', {})
const numericFacet = makeFacet<'numeric', RuntimeNumeric<Unit>>('numeric', {})
const decibelFacet = makeFacet<'numeric', RuntimeNumeric<'db'>>('numeric', { unit: 'db' }, {
  format: () => 'numeric(db)'
})
const hertzFacet = makeFacet<'numeric', RuntimeNumeric<'hz'>>('numeric', { unit: 'hz' }, {
  format: () => 'numeric(hz)'
})

const stringType = makeType(stringFacet)
const numberType = makeType(numberFacet)
const stringAndNumberType = makeType(stringFacet, numberFacet)
const numericType = makeType(numericFacet)
const decibelType = makeType(decibelFacet)
const hertzType = makeType(hertzFacet)

const numericUnion = makeUnion(decibelType, hertzType)

describe('type-system', () => {
  describe('DataForFacet', () => {
    it('should infer facet data', () => {
      expectTypeEquals<string, DataForFacet<typeof stringFacet>>()
      expectTypeEquals<RuntimeNumeric<Unit>, DataForFacet<typeof numericFacet>>()
    })
  })

  describe('DataForFacets', () => {
    it('should infer facet data', () => {
      expectTypeEquals<[string, number], DataForFacets<[typeof stringFacet, typeof numberFacet]>>()
      expectTypeEquals<[], DataForFacets<[]>>()
    })
  })

  describe('ValueForType', () => {
    it('should infer values for facet types and unions', () => {
      expectTypeEquals<Value<typeof stringFacet>, ValueForType<typeof stringType>>()
      expectTypeEquals<ValueForType<typeof decibelType> | ValueForType<typeof hertzType>, ValueForType<typeof numericUnion>>()
    })
  })

  describe('get()', () => {
    it('should infer a more specific data type from the value if available', () => {
      const specificValue = decibelType.of(runtimeNumeric('db', 42))
      const specificData = numericFacet.get(specificValue)
      expectTypeEquals<RuntimeNumeric<Unit> & RuntimeNumeric<'db'>, typeof specificData>()
      expectTypeEquals<'db', typeof specificData.unit>()
      assert.strictEqual(specificData.unit, 'db')
      assert.strictEqual(specificData.value, 42)

      const widenedValue: Value = specificValue
      const widenedData = numericFacet.get(widenedValue)
      expectTypeEquals<RuntimeNumeric<Unit>, typeof widenedData>()
      expectTypeEquals<Unit, typeof widenedData.unit>()
      assert.strictEqual(widenedData.unit, 'db')
      assert.strictEqual(widenedData.value, 42)
    })
  })

  describe('Facet', () => {
    it('should format facets with default and custom formatting', () => {
      assert.strictEqual(stringFacet.format(), 'string')
      assert.strictEqual(decibelFacet.format(), 'numeric(db)')
    })

    it('should compare facets using identity, custom comparable, and type generics', () => {
      assert.strictEqual(stringFacet.is(stringFacet), true)
      assert.strictEqual(numberFacet.is(numberFacet), true)
      assert.strictEqual(stringFacet.is(numberFacet), false)
      assert.strictEqual(numberFacet.is(stringFacet), false)

      assert.strictEqual(numericFacet.is(decibelFacet), true)
      assert.strictEqual(decibelFacet.is(numericFacet), false)

      const customComparableFacetA = makeFacet<'custom', unknown>('custom', {
        foobar: {
          checkAssignableFrom: (other): boolean => other === customComparableFacetA
        }
      })
      const customComparableFacetB = makeFacet<'custom', unknown>('custom', {
        foobar: {
          checkAssignableFrom: (other): boolean => other === customComparableFacetB
        }
      })

      assert.strictEqual(customComparableFacetA.is(customComparableFacetA), true)
      assert.strictEqual(customComparableFacetA.is(customComparableFacetB), false)

      const unionGenericFacetA = makeFacet<'generic', unknown>('generic', {
        foobar: makeUnion(decibelType, hertzType)
      })
      const unionGenericFacetB = makeFacet<'generic', unknown>('generic', {
        foobar: makeUnion(decibelType, hertzType)
      })

      assert.strictEqual(unionGenericFacetA.is(unionGenericFacetB), true)

      const simpleGenericFacet = makeFacet<'generic', unknown>('generic', {
        foobar: decibelType
      })

      assert.strictEqual(unionGenericFacetA.is(simpleGenericFacet), true)
      assert.strictEqual(simpleGenericFacet.is(unionGenericFacetA), false)
    })

    it('should compare facets against types and unions', () => {
      assert.strictEqual(numericFacet.is(decibelType), true)
      assert.strictEqual(decibelFacet.is(numericType), false)
      assert.strictEqual(numericFacet.is(numericUnion), true)
      assert.strictEqual(decibelFacet.is(numericUnion), false)
    })

    it('should check values', () => {
      const pairValue = stringAndNumberType.of('hello', 42)
      const broadRuntimeNumericValue = numericType.of(runtimeNumeric(undefined, 5))
      const decibelValue = decibelType.of(runtimeNumeric('db', 42))

      assert.strictEqual(stringFacet.has(pairValue), true)
      assert.strictEqual(numberFacet.has(pairValue), true)
      assert.strictEqual(decibelFacet.has(decibelValue), true)
      assert.strictEqual(numericFacet.has(decibelValue), true)
      assert.strictEqual(decibelFacet.has(broadRuntimeNumericValue), false)
    })

    it('should retrieve facet data', () => {
      const pairValue = stringAndNumberType.of('hello', 42)
      const broadRuntimeNumericValue = numericType.of(runtimeNumeric(undefined, 5))
      const decibelValue = decibelType.of(runtimeNumeric('db', 42))

      assert.strictEqual(stringFacet.get(pairValue), 'hello')
      assert.strictEqual(numberFacet.get(pairValue), 42)
      assert.deepStrictEqual(decibelFacet.get(decibelValue), runtimeNumeric('db', 42))

      assert.throws(() => stringFacet.get(decibelValue), /Value is not assignable to facet: string/)
      assert.throws(() => decibelFacet.get(broadRuntimeNumericValue), /Value is not assignable to facet: numeric/)
    })

    it('should narrow values through has()', () => {
      const maybeFacetValue: Value = decibelType.of(runtimeNumeric('db', 42))
      if (!numericFacet.has(maybeFacetValue)) {
        assert.fail('Expected numericFacet.has() to narrow a decibel value')
      }
      const narrowedFacetValue: Value<typeof numericFacet> = maybeFacetValue
      assert.strictEqual(numericFacet.get(narrowedFacetValue).unit, 'db')
    })

    it('should cache the single-facet type returned by type()', () => {
      const facetType = stringFacet.type()
      const facetValue = facetType.of('hello')

      assert.strictEqual(facetType, stringFacet.type())
      assert.strictEqual(facetType.format(), 'string')
      assert.strictEqual(facetType.getFacet('string'), stringFacet)
      assert.strictEqual(facetType.has(facetValue), true)
    })
  })

  describe('FacetType', () => {
    it('should throw if given zero facets', () => {
      assert.throws(() => makeType(), /Expected at least one facet/)
    })

    it('should store facets', () => {
      assert.deepStrictEqual(Array.from(stringAndNumberType.facets.keys()), ['string', 'number'])
      assert.strictEqual(stringAndNumberType.facets.get('string'), stringFacet)
      assert.strictEqual(stringAndNumberType.facets.get('number'), numberFacet)
    })

    it('should format based on facets', () => {
      assert.strictEqual(stringAndNumberType.format(), 'string + number')
      assert.strictEqual(decibelType.format(), 'numeric(db)')
    })

    it('should compare assignability for exact, broader, incompatible, and union types', () => {
      assert.strictEqual(stringType.is(stringType), true)
      assert.strictEqual(stringType.is(stringAndNumberType), true)
      assert.strictEqual(stringAndNumberType.is(stringType), false)
      assert.strictEqual(stringType.is(numberType), false)

      assert.strictEqual(numericType.is(decibelType), true)
      assert.strictEqual(decibelType.is(numericType), false)
      assert.strictEqual(numericType.is(numericUnion), true)
      assert.strictEqual(decibelType.is(numericUnion), false)

      assert.strictEqual(numericUnion.is(numericUnion), true)
    })

    it('should create values with data map based on facets', () => {
      const pairValue = stringAndNumberType.of('hello', 42)

      assert.strictEqual(pairValue.type, stringAndNumberType)
      assert.deepStrictEqual(Array.from(pairValue.data.entries()), [
        ['string', 'hello'],
        ['number', 42]
      ])
    })

    it('should check compatibility', () => {
      const pairValue = stringAndNumberType.of('hello', 42)
      const stringValue = stringType.of('hello')

      assert.strictEqual(stringAndNumberType.has(pairValue), true)
      assert.strictEqual(stringType.has(pairValue), true)
      assert.strictEqual(numberType.has(pairValue), true)
      assert.strictEqual(stringAndNumberType.has(stringValue), false)
      assert.strictEqual(numberType.has(stringValue), false)
    })

    it('should return facets by name', () => {
      assert.strictEqual(stringAndNumberType.getFacet('string'), stringFacet)
      assert.strictEqual(stringAndNumberType.getFacet('number'), numberFacet)
      assert.throws(() => stringAndNumberType.getFacet('missing'), /Facet missing not found in type/)
    })

    it('should reject missing or duplicate names', () => {
      const duplicateStringFacet = makeFacet<'string', number>('string', { variant: true })

      assert.throws(() => makeType(stringFacet, duplicateStringFacet), /Duplicate facet names are not allowed in a type/)
      assert.throws(() => makeType(decibelFacet, hertzFacet), /Duplicate facet names are not allowed in a type/)
    })

    it('should narrow values through has()', () => {
      const maybeTypeValue: Value = decibelType.of(runtimeNumeric('db', 42))
      if (!decibelType.has(maybeTypeValue)) {
        assert.fail('Expected decibelType.has() to narrow a decibel value')
      }
      const narrowedTypeValue: ValueForType<typeof decibelType> = maybeTypeValue
      assert.strictEqual(decibelFacet.get(narrowedTypeValue).unit, 'db')
    })
  })

  describe('UnionType', () => {
    it('should throw if given zero members', () => {
      assert.throws(() => makeUnion(), /Expected at least one member/)
    })

    it('should store members', () => {
      const primitiveUnion = makeUnion(stringType, numberType)
      assert.deepStrictEqual(primitiveUnion.members, [stringType, numberType])
    })

    it('should format based on members', () => {
      const primitiveUnion = makeUnion(stringType, numberType)
      assert.strictEqual(primitiveUnion.format(), 'string | number')
      assert.strictEqual(numericUnion.format(), 'numeric(db) | numeric(hz)')
    })

    it('should compare assignability against members and other unions', () => {
      const primitiveUnion = makeUnion(stringType, numberType)
      const widerUnion = makeUnion(stringType, numberType, decibelType)
      const narrowerUnion = makeUnion(stringType)

      assert.strictEqual(primitiveUnion.is(primitiveUnion), true)
      assert.strictEqual(primitiveUnion.is(stringType), true)
      assert.strictEqual(primitiveUnion.is(numberType), true)
      assert.strictEqual(primitiveUnion.is(stringAndNumberType), true)
      assert.strictEqual(primitiveUnion.is(widerUnion), false)
      assert.strictEqual(primitiveUnion.is(narrowerUnion), true)
      assert.strictEqual(narrowerUnion.is(primitiveUnion), false)
      assert.strictEqual(primitiveUnion.is(decibelType), false)
    })

    it('should accept values from any compatible member type', () => {
      const primitiveUnion = makeUnion(stringType, numberType)
      const stringValue = stringType.of('hello')
      const pairValue = stringAndNumberType.of('hello', 42)
      const decibelValue = decibelType.of(runtimeNumeric('db', 42))
      const broadRuntimeNumericValue = numericType.of(runtimeNumeric(undefined, 5))

      assert.strictEqual(primitiveUnion.has(stringValue), true)
      assert.strictEqual(primitiveUnion.has(pairValue), true)
      assert.strictEqual(primitiveUnion.has(decibelValue), false)

      assert.strictEqual(numericUnion.has(decibelValue), true)
      assert.strictEqual(numericUnion.has(broadRuntimeNumericValue), false)
    })

    it('should narrow values through has()', () => {
      const maybeUnionValue: Value = hertzType.of(runtimeNumeric('hz', 1000))
      if (!numericUnion.has(maybeUnionValue)) {
        assert.fail('Expected numericUnion.has() to narrow a member value')
      }
      assert.strictEqual(numericFacet.get(maybeUnionValue).unit, 'hz')
    })
  })

  describe('Value', () => {
    it('should keep its originating type and per-facet data map', () => {
      const value = stringAndNumberType.of('hello', 42)
      const data = value.data as ReadonlyMap<string, unknown>

      assert.strictEqual(value.type, stringAndNumberType)
      assert.strictEqual(value.data.get('string'), 'hello')
      assert.strictEqual(value.data.get('number'), 42)
      assert.strictEqual(data.has('missing'), false)
    })
  })
})
