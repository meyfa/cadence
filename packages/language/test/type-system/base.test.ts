import type { RuntimeNumeric } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { BooleanFacet } from '../../src/type-system/base/boolean.ts'
import type { Function, FunctionSpec } from '../../src/type-system/base/function.ts'
import { FunctionFacet } from '../../src/type-system/base/function.ts'
import type { Module } from '../../src/type-system/base/module.ts'
import { ModuleFacet } from '../../src/type-system/base/module.ts'
import { NumberFacet } from '../../src/type-system/base/number.ts'
import { RecordFacet } from '../../src/type-system/base/record.ts'
import { StringFacet } from '../../src/type-system/base/string.ts'
import { makeFacetType, makeUnionType } from '../../src/type-system/factory.ts'
import { makeSchema } from '../../src/type-system/schema.ts'
import type { ValueForType } from '../../src/type-system/types.ts'
import { expectTypeEquals } from '../test-utils.ts'

describe('type-system/base', () => {
  describe('BooleanFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(BooleanFacet.format(), 'boolean')
    })

    it('should compare by identity', () => {
      assert.strictEqual(BooleanFacet.is(BooleanFacet), true)
      assert.strictEqual(BooleanFacet.is(NumberFacet), false)
    })

    it('should round-trip values', () => {
      for (const item of [true, false]) {
        const value = BooleanFacet.type().of(item)
        assert.strictEqual(BooleanFacet.has(value), true)
        assert.strictEqual(BooleanFacet.get(value), item)
      }
    })

    it('should merge by identity', () => {
      assert.strictEqual(BooleanFacet.merge(BooleanFacet), BooleanFacet)
      assert.strictEqual(BooleanFacet.merge(NumberFacet), undefined)
    })

    it('should intersect by identity', () => {
      assert.strictEqual(BooleanFacet.intersect(BooleanFacet), BooleanFacet)
      assert.strictEqual(BooleanFacet.intersect(NumberFacet), undefined)
    })

    it('should create a single-facet type', () => {
      const booleanType = BooleanFacet.type()
      assert.deepStrictEqual([...booleanType.facets.keys()], ['boolean'])
    })
  })

  describe('FunctionFacet', () => {
    it('should format as function signature', () => {
      const noParametersReturnString = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })
      assert.strictEqual(
        noParametersReturnString.format(),
        '(): string'
      )

      const oneParameterReturnComplex = FunctionFacet.with({
        parameters: makeSchema([
          { name: 'amount', type: NumberFacet.with('db').type(), required: true }
        ]),
        returnType: makeFacetType(StringFacet, RecordFacet.with({ gain: NumberFacet.with('db').type() })),
        capabilities: { mayBlock: false }
      })
      assert.strictEqual(
        oneParameterReturnComplex.format(),
        '(amount: number.db): (string + {gain: number.db})'
      )

      const optionalParameterReturnString = FunctionFacet.with({
        parameters: makeSchema([
          { name: 'amount', type: NumberFacet.with('db').type(), required: false }
        ]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })
      assert.strictEqual(
        optionalParameterReturnString.format(),
        '(amount?: number.db): string'
      )

      const mayBlockFunction = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: true }
      })
      assert.strictEqual(
        mayBlockFunction.format(),
        '(): string !may_block'
      )
    })

    it('should compare based on parameters, return type, and capabilities', () => {
      const noParametersReturnString = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const noParametersReturnStringBlocking = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: true }
      })

      const oneParameterReturnString = FunctionFacet.with({
        parameters: makeSchema([{ name: 'amount', type: NumberFacet.with(undefined).type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const optionalParameterReturnString = FunctionFacet.with({
        parameters: makeSchema([{ name: 'amount', type: NumberFacet.with(undefined).type(), required: false }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const noParametersReturnNumber = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: NumberFacet.type(),
        capabilities: { mayBlock: false }
      })

      // same parameter count and type but different parameter name
      const sameOneParameterReturnString = FunctionFacet.with({
        parameters: makeSchema([{ name: 'value', type: NumberFacet.with(undefined).type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      // same parameter count and name, but different parameter type
      const otherOneParameterReturnString = FunctionFacet.with({
        parameters: makeSchema([{ name: 'amount', type: NumberFacet.with('db').type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      // base facet is assignable from all of its specializations
      assert.strictEqual(FunctionFacet.is(FunctionFacet), true)
      assert.strictEqual(FunctionFacet.is(noParametersReturnString), true)
      assert.strictEqual(FunctionFacet.is(noParametersReturnStringBlocking), true)
      assert.strictEqual(FunctionFacet.is(oneParameterReturnString), true)
      assert.strictEqual(FunctionFacet.is(optionalParameterReturnString), true)

      // specializations are not assignable to base facet
      assert.strictEqual(noParametersReturnString.is(FunctionFacet), false)
      assert.strictEqual(noParametersReturnStringBlocking.is(FunctionFacet), false)
      assert.strictEqual(oneParameterReturnString.is(FunctionFacet), false)
      assert.strictEqual(optionalParameterReturnString.is(FunctionFacet), false)

      // specializations are assignable to themselves
      assert.strictEqual(noParametersReturnString.is(noParametersReturnString), true)
      assert.strictEqual(noParametersReturnStringBlocking.is(noParametersReturnStringBlocking), true)
      assert.strictEqual(oneParameterReturnString.is(oneParameterReturnString), true)
      assert.strictEqual(optionalParameterReturnString.is(optionalParameterReturnString), true)

      // non-mayBlock is assignable to mayBlock, but not vice versa
      assert.strictEqual(noParametersReturnStringBlocking.is(noParametersReturnString), true)
      assert.strictEqual(noParametersReturnString.is(noParametersReturnStringBlocking), false)

      // different parameter counts are not assignable
      assert.strictEqual(noParametersReturnString.is(oneParameterReturnString), false)
      assert.strictEqual(oneParameterReturnString.is(noParametersReturnString), false)

      // different parameter names are not assignable
      assert.strictEqual(oneParameterReturnString.is(sameOneParameterReturnString), false)
      assert.strictEqual(sameOneParameterReturnString.is(oneParameterReturnString), false)

      // different parameter types are not assignable
      assert.strictEqual(oneParameterReturnString.is(otherOneParameterReturnString), false)
      assert.strictEqual(otherOneParameterReturnString.is(oneParameterReturnString), false)

      // optional parameter is assignable to required parameter, but not vice versa
      assert.strictEqual(oneParameterReturnString.is(optionalParameterReturnString), true)
      assert.strictEqual(optionalParameterReturnString.is(oneParameterReturnString), false)

      // optional parameter is assignable to zero parameters, but not vice versa
      assert.strictEqual(noParametersReturnString.is(optionalParameterReturnString), true)
      assert.strictEqual(optionalParameterReturnString.is(noParametersReturnString), false)

      // different return types are not assignable
      assert.strictEqual(noParametersReturnNumber.is(noParametersReturnString), false)
      assert.strictEqual(noParametersReturnString.is(noParametersReturnNumber), false)

      const broadRecord = RecordFacet.with({ gain: NumberFacet.with('db').type() })
      const narrowRecord = RecordFacet.with({ gain: NumberFacet.with('db').type(), frequency: NumberFacet.with('hz').type() })

      const broadParameter = FunctionFacet.with({
        parameters: makeSchema([{ name: 'record', type: broadRecord.type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const narrowParameter = FunctionFacet.with({
        parameters: makeSchema([{ name: 'record', type: narrowRecord.type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      // broad parameter is assignable to narrow parameter, but not vice versa (contravariant)
      assert.strictEqual(narrowParameter.is(broadParameter), true)
      assert.strictEqual(broadParameter.is(narrowParameter), false)

      const broadReturn = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: broadRecord.type(),
        capabilities: { mayBlock: false }
      })

      const narrowReturn = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: narrowRecord.type(),
        capabilities: { mayBlock: false }
      })

      // narrow return is assignable to broad return, but not vice versa (covariant)
      assert.strictEqual(broadReturn.is(narrowReturn), true)
      assert.strictEqual(narrowReturn.is(broadReturn), false)
    })

    it('should merge function facets with identical specs', () => {
      const spec: FunctionSpec = {
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      }

      const facetA = FunctionFacet.with(spec)
      const facetB = FunctionFacet.with(spec)

      const mergedAB = facetA.merge(facetB)
      assert.strictEqual(mergedAB, facetA)

      const mergedBA = facetB.merge(facetA)
      assert.strictEqual(mergedBA, facetB)

      const differentSpec: FunctionSpec = {
        parameters: makeSchema([
          { name: 'amount', type: NumberFacet.with(undefined).type(), required: false }
        ]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      }

      const facetC = FunctionFacet.with(differentSpec)

      const mergedAC = facetA.merge(facetC)
      assert.strictEqual(mergedAC, undefined)

      const mergedCA = facetC.merge(facetA)
      assert.strictEqual(mergedCA, undefined)
    })

    it('should intersect function facets based on assignability of parameters and return types', () => {
      const noParametersReturnString = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const noParametersReturnStringBlocking = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: true }
      })

      const oneParameterReturnString = FunctionFacet.with({
        parameters: makeSchema([{ name: 'amount', type: NumberFacet.with(undefined).type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const optionalParameterReturnString = FunctionFacet.with({
        parameters: makeSchema([{ name: 'amount', type: NumberFacet.with(undefined).type(), required: false }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const noParametersReturnNumber = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: NumberFacet.type(),
        capabilities: { mayBlock: false }
      })

      const sameOneParameterReturnString = FunctionFacet.with({
        parameters: makeSchema([{ name: 'value', type: NumberFacet.with(undefined).type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const otherOneParameterReturnString = FunctionFacet.with({
        parameters: makeSchema([{ name: 'amount', type: NumberFacet.with('db').type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const identicalA = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const identicalB = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const broadRecord = RecordFacet.with({ gain: NumberFacet.with('db').type() })
      const narrowRecord = RecordFacet.with({ gain: NumberFacet.with('db').type(), frequency: NumberFacet.with('hz').type() })

      const broadParameter = FunctionFacet.with({
        parameters: makeSchema([{ name: 'record', type: broadRecord.type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const narrowParameter = FunctionFacet.with({
        parameters: makeSchema([{ name: 'record', type: narrowRecord.type(), required: true }]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      })

      const broadReturn = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: broadRecord.type(),
        capabilities: { mayBlock: false }
      })

      const narrowReturn = FunctionFacet.with({
        parameters: makeSchema([]),
        returnType: narrowRecord.type(),
        capabilities: { mayBlock: false }
      })

      assert.strictEqual(identicalA.intersect(identicalB), identicalA)
      assert.strictEqual(identicalB.intersect(identicalA), identicalB)

      const intersectedBaseSpecific = FunctionFacet.intersect(noParametersReturnString)
      assert.ok(intersectedBaseSpecific != null)
      assert.strictEqual(intersectedBaseSpecific.format(), FunctionFacet.format())
      assert.strictEqual(intersectedBaseSpecific.is(FunctionFacet), true)
      assert.strictEqual(FunctionFacet.is(intersectedBaseSpecific), true)

      assert.strictEqual(noParametersReturnString.intersect(FunctionFacet), FunctionFacet)

      assert.strictEqual(noParametersReturnStringBlocking.intersect(noParametersReturnString), noParametersReturnStringBlocking)
      assert.strictEqual(noParametersReturnString.intersect(noParametersReturnStringBlocking), noParametersReturnStringBlocking)

      assert.strictEqual(oneParameterReturnString.intersect(optionalParameterReturnString), oneParameterReturnString)
      assert.strictEqual(optionalParameterReturnString.intersect(oneParameterReturnString), oneParameterReturnString)

      assert.strictEqual(noParametersReturnString.intersect(optionalParameterReturnString), noParametersReturnString)
      assert.strictEqual(optionalParameterReturnString.intersect(noParametersReturnString), noParametersReturnString)

      assert.strictEqual(narrowParameter.intersect(broadParameter), narrowParameter)
      assert.strictEqual(broadParameter.intersect(narrowParameter), narrowParameter)

      assert.strictEqual(broadReturn.intersect(narrowReturn), broadReturn)
      assert.strictEqual(narrowReturn.intersect(broadReturn), broadReturn)

      assert.strictEqual(noParametersReturnString.intersect(oneParameterReturnString), undefined)
      assert.strictEqual(oneParameterReturnString.intersect(noParametersReturnString), undefined)

      assert.strictEqual(oneParameterReturnString.intersect(sameOneParameterReturnString), undefined)
      assert.strictEqual(sameOneParameterReturnString.intersect(oneParameterReturnString), undefined)

      assert.strictEqual(oneParameterReturnString.intersect(otherOneParameterReturnString), undefined)
      assert.strictEqual(otherOneParameterReturnString.intersect(oneParameterReturnString), undefined)

      assert.strictEqual(noParametersReturnString.intersect(noParametersReturnNumber), undefined)
      assert.strictEqual(noParametersReturnNumber.intersect(noParametersReturnString), undefined)

      assert.strictEqual(noParametersReturnString.intersect(StringFacet), undefined)
    })

    it('should create a single-facet type', () => {
      const functionType = FunctionFacet.type()
      assert.deepStrictEqual([...functionType.facets.keys()], ['function'])

      const spec: FunctionSpec = {
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        capabilities: { mayBlock: false }
      }
      const functionTypeWithSpec = FunctionFacet.with(spec).type()
      assert.deepStrictEqual([...functionTypeWithSpec.facets.keys()], ['function'])
    })

    it('should preserve function specs through with() and detail()', () => {
      const amountType = NumberFacet.with('db').type()
      const returnType = StringFacet.type()
      const capabilities = { mayBlock: true }
      const schema = makeSchema([
        { name: 'amount', type: amountType, required: true },
        { name: 'label', type: returnType, required: false }
      ])
      const spec = { parameters: schema, returnType, capabilities }
      const typedFacet = FunctionFacet.with(spec)
      const typedType = typedFacet.type()

      const func: Function<typeof schema, typeof returnType> = {
        parameters: schema,
        returnType,
        capabilities,
        invoke: (_context, args) => args.label ?? returnType.of('fallback'),
        summary: 'demo function'
      }

      const value = typedType.of(func)
      const loadedFunction = typedFacet.get(value)
      const result = loadedFunction.invoke(undefined as never, {
        amount: amountType.of(runtimeNumeric('db', -6))
      })

      expectTypeEquals<Function<typeof schema, typeof returnType>, typeof loadedFunction>()
      expectTypeEquals<ValueForType<typeof returnType>, typeof result>()

      assert.strictEqual(typedFacet.is(FunctionFacet.with(spec)), true)

      assert.strictEqual(FunctionFacet.detail(typedType), spec)
      assert.strictEqual(StringFacet.get(result), 'fallback')
      assert.throws(() => FunctionFacet.detail(FunctionFacet.type()), /Invalid generics for function facet/)
    })
  })

  describe('ModuleFacet', () => {
    it('should format as facet name with module name', () => {
      const moduleValue: Module = {
        name: 'demo',
        exports: new Map([])
      }

      const typedFacet = ModuleFacet.with(moduleValue)
      assert.strictEqual(typedFacet.format(), 'module("demo")')
    })

    it('should compare by identity', () => {
      const moduleValue: Module = {
        name: 'test',
        exports: new Map([])
      }

      const typedFacetA = ModuleFacet.with(moduleValue)
      const typedFacetB = ModuleFacet.with(moduleValue)
      const typedFacetC = ModuleFacet.with({ ...moduleValue })

      assert.strictEqual(ModuleFacet.is(ModuleFacet), true)

      assert.strictEqual(typedFacetA.is(typedFacetA), true)
      assert.strictEqual(typedFacetA.is(typedFacetB), true)
      assert.strictEqual(typedFacetA.is(typedFacetC), false)

      assert.strictEqual(ModuleFacet.is(StringFacet), false)
    })

    it('should create a single-facet type', () => {
      const moduleType = ModuleFacet.type()
      assert.deepStrictEqual([...moduleType.facets.keys()], ['module'])

      const moduleValue: Module = {
        name: 'demo',
        exports: new Map([])
      }
      const moduleTypeWithValue = ModuleFacet.with(moduleValue).type()
      assert.deepStrictEqual([...moduleTypeWithValue.facets.keys()], ['module'])
    })

    it('should preserve module identity through with() and detail()', () => {
      const greeting = StringFacet.type().of('hello')
      const moduleValue: Module = {
        name: 'demo',
        exports: new Map([['greeting', greeting]])
      }

      const typedFacet = ModuleFacet.with(moduleValue)
      const typedType = typedFacet.type()
      const value = typedType.of(moduleValue)
      const loadedModule = typedFacet.get(value)

      expectTypeEquals<Module, typeof loadedModule>()
      assert.strictEqual(ModuleFacet.detail(typedType), moduleValue)
      assert.strictEqual(loadedModule.exports.get('greeting'), greeting)
      assert.throws(() => ModuleFacet.detail(ModuleFacet.type()), /Invalid generics for module facet/)
    })
  })

  describe('NumberFacet', () => {
    it('should format as facet name with unit suffix', () => {
      assert.strictEqual(NumberFacet.format(), 'number')
      assert.strictEqual(NumberFacet.with(undefined).format(), 'number')
      assert.strictEqual(NumberFacet.with('db').format(), 'number.db')
    })

    it('should compare based on unit', () => {
      assert.strictEqual(NumberFacet.is(NumberFacet), true)

      assert.strictEqual(NumberFacet.with(undefined).is(NumberFacet.with(undefined)), true)
      assert.strictEqual(NumberFacet.with('db').is(NumberFacet.with('db')), true)

      assert.strictEqual(NumberFacet.with('db').is(NumberFacet.with(undefined)), false)
      assert.strictEqual(NumberFacet.with('db').is(NumberFacet.with('hz')), false)

      assert.strictEqual(NumberFacet.is(NumberFacet.with('db')), true)
      assert.strictEqual(NumberFacet.with('db').is(NumberFacet), false)

      assert.strictEqual(NumberFacet.is(StringFacet), false)
      assert.strictEqual(NumberFacet.with('db').is(StringFacet), false)
    })

    it('should merge number facets with identical units', () => {
      const facetA = NumberFacet.with('db')
      const facetB = NumberFacet.with('db')
      const facetC = NumberFacet.with('hz')
      const facetD = NumberFacet.with(undefined)

      const mergedAB = facetA.merge(facetB)
      assert.strictEqual(mergedAB, facetA)

      const mergedBA = facetB.merge(facetA)
      assert.strictEqual(mergedBA, facetB)

      const mergedAC = facetA.merge(facetC)
      assert.strictEqual(mergedAC, undefined)

      const mergedCA = facetC.merge(facetA)
      assert.strictEqual(mergedCA, undefined)

      const mergedAD = facetA.merge(facetD)
      assert.strictEqual(mergedAD, undefined)

      const mergedDA = facetD.merge(facetA)
      assert.strictEqual(mergedDA, undefined)
    })

    it('should intersect number facets with identical units', () => {
      const facetA = NumberFacet.with('db')
      const facetB = NumberFacet.with('db')
      const facetC = NumberFacet.with('hz')
      const facetD = NumberFacet.with(undefined)

      const intersectionAB = facetA.intersect(facetB)
      assert.strictEqual(intersectionAB, facetA)

      const intersectionBA = facetB.intersect(facetA)
      assert.strictEqual(intersectionBA, facetB)

      const intersectionAC = facetA.intersect(facetC)
      assert.strictEqual(intersectionAC, undefined)

      const intersectionCA = facetC.intersect(facetA)
      assert.strictEqual(intersectionCA, undefined)

      const intersectionAD = facetA.intersect(facetD)
      assert.strictEqual(intersectionAD, undefined)

      const intersectionDA = facetD.intersect(facetA)
      assert.strictEqual(intersectionDA, undefined)
    })

    it('should create a single-facet type', () => {
      const numberType = NumberFacet.type()
      assert.deepStrictEqual([...numberType.facets.keys()], ['number'])

      const numberTypeWithUnit = NumberFacet.with('db').type()
      assert.deepStrictEqual([...numberTypeWithUnit.facets.keys()], ['number'])
    })

    it('should support unit-specific facets and detail()', () => {
      const genericValue = NumberFacet.type().of(runtimeNumeric('db', -3))
      const decibelFacet = NumberFacet.with('db')
      const decibelType = decibelFacet.type()
      const decibelValue = decibelType.of(runtimeNumeric('db', -3))
      const specificData = decibelFacet.get(decibelValue)

      expectTypeEquals<RuntimeNumeric<'db'>, typeof specificData>()
      assert.strictEqual(NumberFacet.has(decibelValue), true)
      assert.strictEqual(decibelFacet.has(genericValue), false)
      assert.strictEqual(NumberFacet.detail(decibelType), 'db')
      assert.strictEqual(specificData.unit, 'db')
      assert.strictEqual(specificData.value, -3)
      assert.throws(() => NumberFacet.detail(NumberFacet.type()), /Invalid generics for number facet/)
    })
  })

  describe('RecordFacet', () => {
    it('should format as facet name with field names and types', () => {
      const recordFacet = RecordFacet.with({ gain: NumberFacet.type(), label: StringFacet.type() })
      assert.strictEqual(recordFacet.format(), '{gain: number, label: string}')

      const emptyRecordFacet = RecordFacet.with({})
      assert.strictEqual(emptyRecordFacet.format(), '{}')
    })

    it('should compare by field assignability', () => {
      const emptyRecordFacet = RecordFacet.with({})

      const broadRecordFacet = RecordFacet.with({
        gain: NumberFacet.type()
      })

      const narrowRecordFacet = RecordFacet.with({
        gain: NumberFacet.with('db').type(),
        label: StringFacet.type()
      })

      assert.strictEqual(RecordFacet.is(RecordFacet), true)
      assert.strictEqual(RecordFacet.is(emptyRecordFacet), true)
      assert.strictEqual(RecordFacet.is(broadRecordFacet), true)
      assert.strictEqual(RecordFacet.is(narrowRecordFacet), true)

      // RecordFacet without .with() has unknown generics. Hence, it cannot reasonably be assigned
      // to anything except the empty record facet, since the empty record facet does not require any fields.
      assert.strictEqual(emptyRecordFacet.is(RecordFacet), true)
      assert.strictEqual(broadRecordFacet.is(RecordFacet), false)
      assert.strictEqual(narrowRecordFacet.is(RecordFacet), false)

      assert.strictEqual(emptyRecordFacet.is(emptyRecordFacet), true)
      assert.strictEqual(broadRecordFacet.is(broadRecordFacet), true)
      assert.strictEqual(narrowRecordFacet.is(narrowRecordFacet), true)

      assert.strictEqual(emptyRecordFacet.is(broadRecordFacet), true)
      assert.strictEqual(broadRecordFacet.is(emptyRecordFacet), false)

      assert.strictEqual(broadRecordFacet.is(narrowRecordFacet), true)
      assert.strictEqual(narrowRecordFacet.is(broadRecordFacet), false)

      assert.strictEqual(RecordFacet.is(StringFacet), false)
      assert.strictEqual(emptyRecordFacet.is(StringFacet), false)
      assert.strictEqual(broadRecordFacet.is(StringFacet), false)
    })

    it('should merge record generics', () => {
      const emptyRecordFacet = RecordFacet.with({})

      const broadRecordFacet = RecordFacet.with({
        gain: NumberFacet.with('db').type()
      })

      const narrowRecordFacet = RecordFacet.with({
        gain: NumberFacet.with('db').type(),
        label: StringFacet.type()
      })

      const incompatibleRecordFacet = RecordFacet.with({
        gain: NumberFacet.with('hz').type(),
        label: StringFacet.type()
      })

      const mergedEmptyEmpty = emptyRecordFacet.merge(emptyRecordFacet)
      assert.ok(mergedEmptyEmpty != null)
      assert.strictEqual(mergedEmptyEmpty.name, 'record')
      assert.deepStrictEqual(mergedEmptyEmpty.generics, emptyRecordFacet.generics)

      const mergedBroadBroad = broadRecordFacet.merge(broadRecordFacet)
      assert.ok(mergedBroadBroad != null)
      assert.strictEqual(mergedBroadBroad.name, 'record')
      assert.deepStrictEqual(mergedBroadBroad.generics, broadRecordFacet.generics)

      const mergedNarrowNarrow = narrowRecordFacet.merge(narrowRecordFacet)
      assert.ok(mergedNarrowNarrow != null)
      assert.strictEqual(mergedNarrowNarrow.name, 'record')
      assert.deepStrictEqual(mergedNarrowNarrow.generics, narrowRecordFacet.generics)

      const mergedBroadNarrow = broadRecordFacet.merge(narrowRecordFacet)
      assert.ok(mergedBroadNarrow != null)
      assert.strictEqual(mergedBroadNarrow.name, 'record')
      assert.deepStrictEqual(mergedBroadNarrow.generics, narrowRecordFacet.generics)

      const mergedNarrowBroad = narrowRecordFacet.merge(broadRecordFacet)
      assert.ok(mergedNarrowBroad != null)
      assert.strictEqual(mergedNarrowBroad.name, 'record')
      assert.deepStrictEqual(mergedNarrowBroad.generics, narrowRecordFacet.generics)

      const mergedBroadIncompatible = broadRecordFacet.merge(incompatibleRecordFacet)
      assert.strictEqual(mergedBroadIncompatible, undefined)

      const mergedIncompatibleBroad = incompatibleRecordFacet.merge(broadRecordFacet)
      assert.strictEqual(mergedIncompatibleBroad, undefined)

      const mergedEmptyOther = emptyRecordFacet.merge(StringFacet)
      assert.strictEqual(mergedEmptyOther, undefined)

      const mergedBroadOther = broadRecordFacet.merge(StringFacet)
      assert.strictEqual(mergedBroadOther, undefined)

      const stringType = StringFacet.type()
      const numberType = NumberFacet.with(undefined).type()
      const decibelType = NumberFacet.with('db').type()

      const nestedRecordFacet0 = RecordFacet.with({
        foo: RecordFacet.with({
          a: stringType,
          b: numberType
        }).type()
      })

      const nestedRecordFacet1 = RecordFacet.with({
        foo: RecordFacet.with({
          a: numberType,
          c: decibelType
        }).type()
      })

      const mergedNested = nestedRecordFacet0.merge(nestedRecordFacet1)
      assert.ok(mergedNested != null)
      assert.strictEqual(mergedNested.name, 'record')
      assert.deepStrictEqual(Object.keys(mergedNested.generics), ['foo'])

      assert.strictEqual(mergedNested.format(), '{foo: {a: (string + number), b: number, c: number.db}}')

      const numericUnion = makeUnionType(
        NumberFacet.with('db').type(),
        NumberFacet.with('hz').type()
      )
      const unionRecordFacet = RecordFacet.with({ value: numericUnion })
      const stringRecordFacet = RecordFacet.with({ value: StringFacet.type() })

      const mergedUnion = unionRecordFacet.merge(stringRecordFacet)
      assert.ok(mergedUnion != null)
      assert.strictEqual(
        mergedUnion.format(),
        '{value: ((number.db + string) | (number.hz + string))}'
      )
    })

    it('should intersect record generics', () => {
      const emptyRecordFacet = RecordFacet.with({})

      const broadRecordFacet = RecordFacet.with({
        gain: NumberFacet.with('db').type()
      })

      const narrowRecordFacet = RecordFacet.with({
        gain: NumberFacet.with('db').type(),
        label: StringFacet.type()
      })

      const incompatibleRecordFacet = RecordFacet.with({
        gain: NumberFacet.with('hz').type(),
        label: StringFacet.type()
      })

      const labelRecordFacet = RecordFacet.with({
        label: StringFacet.type()
      })

      const intersectedEmptyEmpty = emptyRecordFacet.intersect(emptyRecordFacet)
      assert.ok(intersectedEmptyEmpty != null)
      assert.strictEqual(intersectedEmptyEmpty.name, 'record')
      assert.deepStrictEqual(intersectedEmptyEmpty.generics, emptyRecordFacet.generics)

      const intersectedBroadBroad = broadRecordFacet.intersect(broadRecordFacet)
      assert.ok(intersectedBroadBroad != null)
      assert.strictEqual(intersectedBroadBroad.name, 'record')
      assert.deepStrictEqual(intersectedBroadBroad.generics, broadRecordFacet.generics)

      const intersectedNarrowNarrow = narrowRecordFacet.intersect(narrowRecordFacet)
      assert.ok(intersectedNarrowNarrow != null)
      assert.strictEqual(intersectedNarrowNarrow.name, 'record')
      assert.deepStrictEqual(intersectedNarrowNarrow.generics, narrowRecordFacet.generics)

      const intersectedBroadNarrow = broadRecordFacet.intersect(narrowRecordFacet)
      assert.ok(intersectedBroadNarrow != null)
      assert.strictEqual(intersectedBroadNarrow.name, 'record')
      assert.deepStrictEqual(intersectedBroadNarrow.generics, broadRecordFacet.generics)

      const intersectedNarrowBroad = narrowRecordFacet.intersect(broadRecordFacet)
      assert.ok(intersectedNarrowBroad != null)
      assert.strictEqual(intersectedNarrowBroad.name, 'record')
      assert.deepStrictEqual(intersectedNarrowBroad.generics, broadRecordFacet.generics)

      const intersectedBroadIncompatible = broadRecordFacet.intersect(incompatibleRecordFacet)
      assert.ok(intersectedBroadIncompatible != null)
      assert.strictEqual(intersectedBroadIncompatible.name, 'record')
      assert.deepStrictEqual(intersectedBroadIncompatible.generics, emptyRecordFacet.generics)

      const intersectedIncompatibleBroad = incompatibleRecordFacet.intersect(broadRecordFacet)
      assert.ok(intersectedIncompatibleBroad != null)
      assert.strictEqual(intersectedIncompatibleBroad.name, 'record')
      assert.deepStrictEqual(intersectedIncompatibleBroad.generics, emptyRecordFacet.generics)

      const intersectedNarrowIncompatible = narrowRecordFacet.intersect(incompatibleRecordFacet)
      assert.ok(intersectedNarrowIncompatible != null)
      assert.strictEqual(intersectedNarrowIncompatible.name, 'record')
      assert.deepStrictEqual(intersectedNarrowIncompatible.generics, labelRecordFacet.generics)

      const intersectedIncompatibleNarrow = incompatibleRecordFacet.intersect(narrowRecordFacet)
      assert.ok(intersectedIncompatibleNarrow != null)
      assert.strictEqual(intersectedIncompatibleNarrow.name, 'record')
      assert.deepStrictEqual(intersectedIncompatibleNarrow.generics, labelRecordFacet.generics)

      const intersectedEmptyOther = emptyRecordFacet.intersect(StringFacet)
      assert.strictEqual(intersectedEmptyOther, undefined)

      const intersectedBroadOther = broadRecordFacet.intersect(StringFacet)
      assert.strictEqual(intersectedBroadOther, undefined)

      const nestedRecordFacet0 = RecordFacet.with({
        foo: RecordFacet.with({
          a: StringFacet.type(),
          b: NumberFacet.with(undefined).type()
        }).type()
      })

      const nestedRecordFacet1 = RecordFacet.with({
        foo: RecordFacet.with({
          a: StringFacet.type(),
          c: NumberFacet.with('db').type()
        }).type()
      })

      const intersectedNested = nestedRecordFacet0.intersect(nestedRecordFacet1)
      assert.ok(intersectedNested != null)
      assert.strictEqual(intersectedNested.name, 'record')
      assert.deepStrictEqual(Object.keys(intersectedNested.generics), ['foo'])

      assert.strictEqual(intersectedNested.format(), '{foo: {a: string}}')

      const numericUnion = makeUnionType(
        NumberFacet.with('db').type(),
        NumberFacet.with('hz').type()
      )
      const unionRecordFacet = RecordFacet.with({ value: numericUnion })
      const numberRecordFacet = RecordFacet.with({ value: NumberFacet.type() })

      const intersectedUnion = unionRecordFacet.intersect(numberRecordFacet)
      assert.ok(intersectedUnion != null)
      assert.strictEqual(intersectedUnion.format(), '{value: number}')
    })

    it('should create a single-facet type', () => {
      const recordType = RecordFacet.type()
      assert.deepStrictEqual([...recordType.facets.keys()], ['record'])

      const recordFacetWithFields = RecordFacet.with({ gain: NumberFacet.type(), label: StringFacet.type() })
      const recordTypeWithFields = recordFacetWithFields.type()
      assert.deepStrictEqual([...recordTypeWithFields.facets.keys()], ['record'])
    })

    it('should preserve field types and round-trip record values', () => {
      const gainType = NumberFacet.with('db').type()
      const labelType = StringFacet.type()
      const recordFacet = RecordFacet.with({ gain: gainType, label: labelType })
      const recordType = recordFacet.type()
      const recordValue = recordType.of({
        gain: gainType.of(runtimeNumeric('db', -9)),
        label: labelType.of('lead')
      })
      const recordData = recordFacet.get(recordValue)

      expectTypeEquals<ValueForType<typeof gainType>, typeof recordData.gain>()
      expectTypeEquals<ValueForType<typeof labelType>, typeof recordData.label>()

      assert.strictEqual(RecordFacet.has(recordValue), true)
      assert.strictEqual(RecordFacet.detail(recordType).gain, gainType)
      assert.strictEqual(RecordFacet.detail(recordType).label, labelType)
      assert.strictEqual(NumberFacet.get(recordData.gain).unit, 'db')
      assert.strictEqual(NumberFacet.get(recordData.gain).value, -9)
      assert.strictEqual(StringFacet.get(recordData.label), 'lead')
    })

    it('should reject non-plain objects for record fields', () => {
      assert.throws(
        () => RecordFacet.with({ __proto__: NumberFacet.type() } as Record<string, any>),
        /Expected record facet data to use a plain object or null prototype/
      )
    })

    it('should not expose object prototype properties', () => {
      const recordFacet = RecordFacet.with({ gain: NumberFacet.type() })
      const recordType = recordFacet.type()
      const recordValue = recordType.of({ gain: NumberFacet.with('db').type().of(runtimeNumeric('db', -9)) })
      const recordData = recordFacet.get(recordValue)

      assert.strictEqual(Object.getPrototypeOf(RecordFacet.detail(recordType)), null)
      assert.strictEqual(Object.getPrototypeOf(recordData), null)

      assert.strictEqual(RecordFacet.detail(recordType).__proto__, undefined)
      assert.strictEqual((recordData as Record<string, unknown>).constructor, undefined)

      const genericRecordType = RecordFacet.type()
      const genericRecordValue = genericRecordType.of({ gain: NumberFacet.with('db').type().of(runtimeNumeric('db', -9)) })
      const genericRecordData = RecordFacet.get(genericRecordValue)

      assert.strictEqual(Object.getPrototypeOf(RecordFacet.detail(genericRecordType)), null)
      assert.strictEqual(Object.getPrototypeOf(genericRecordData), null)

      assert.strictEqual(RecordFacet.detail(genericRecordType).__proto__, undefined)
      assert.strictEqual((genericRecordData as Record<string, unknown>).constructor, undefined)
    })

    it('should compare records based on field assignability', () => {
      const broadRecordFacet = RecordFacet.with({ gain: NumberFacet.type() })
      const narrowRecordFacet = RecordFacet.with({ gain: NumberFacet.with('db').type() })

      assert.strictEqual(broadRecordFacet.is(narrowRecordFacet), true)
      assert.strictEqual(narrowRecordFacet.is(broadRecordFacet), false)
    })
  })

  describe('StringFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(StringFacet.format(), 'string')
    })

    it('should compare by identity', () => {
      assert.strictEqual(StringFacet.is(StringFacet), true)
      assert.strictEqual(StringFacet.is(NumberFacet), false)
    })

    it('should round-trip values', () => {
      const value = StringFacet.type().of('hello')
      assert.strictEqual(StringFacet.has(value), true)
      assert.strictEqual(StringFacet.get(value), 'hello')
    })

    it('should merge by identity', () => {
      assert.strictEqual(StringFacet.merge(StringFacet), StringFacet)
      assert.strictEqual(StringFacet.merge(NumberFacet), undefined)
    })

    it('should intersect by identity', () => {
      assert.strictEqual(StringFacet.intersect(StringFacet), StringFacet)
      assert.strictEqual(StringFacet.intersect(NumberFacet), undefined)
    })

    it('should create a single-facet type', () => {
      const stringType = StringFacet.type()
      assert.deepStrictEqual([...stringType.facets.keys()], ['string'])
    })
  })
})
