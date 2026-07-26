import type { RuntimeNumeric } from '@meyfa/cadence-utility'
import { runtimeNumeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { Function, FunctionSpec } from '../../src/type-system/base/function.ts'
import { FunctionFacet } from '../../src/type-system/base/function.ts'
import type { Module } from '../../src/type-system/base/module.ts'
import { ModuleFacet } from '../../src/type-system/base/module.ts'
import { NumberFacet } from '../../src/type-system/base/number.ts'
import { RecordFacet } from '../../src/type-system/base/record.ts'
import { StringFacet } from '../../src/type-system/base/string.ts'
import { makeSchema } from '../../src/type-system/schema.ts'
import type { ValueForType } from '../../src/type-system/types.ts'
import { expectTypeEquals } from '../test-utils.ts'

describe('type-system/base', () => {
  describe('FunctionFacet', () => {
    it('should format as facet name', () => {
      assert.strictEqual(FunctionFacet.format(), 'function')
    })

    it('should compare by identity', () => {
      const spec: FunctionSpec = {
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        effects: { blocking: false }
      }

      assert.strictEqual(FunctionFacet.is(FunctionFacet), true)
      assert.strictEqual(FunctionFacet.with(spec).is(FunctionFacet.with(spec)), true)

      assert.strictEqual(FunctionFacet.with(spec).is(FunctionFacet.with({ ...spec })), false)
      assert.strictEqual(FunctionFacet.with({ ...spec }).is(FunctionFacet.with(spec)), false)

      assert.strictEqual(FunctionFacet.is(FunctionFacet.with(spec)), true)
      assert.strictEqual(FunctionFacet.with(spec).is(FunctionFacet), false)
    })

    it('should create a single-facet type', () => {
      const functionType = FunctionFacet.type()
      assert.deepStrictEqual([...functionType.facets.keys()], ['function'])

      const spec: FunctionSpec = {
        parameters: makeSchema([]),
        returnType: StringFacet.type(),
        effects: { blocking: false }
      }
      const functionTypeWithSpec = FunctionFacet.with(spec).type()
      assert.deepStrictEqual([...functionTypeWithSpec.facets.keys()], ['function'])
    })

    it('should preserve function specs through with() and detail()', () => {
      const amountType = NumberFacet.with('db').type()
      const returnType = StringFacet.type()
      const effects = { blocking: true }
      const schema = makeSchema([
        { name: 'amount', type: amountType, required: true },
        { name: 'label', type: returnType, required: false }
      ])
      const spec = { parameters: schema, returnType, effects }
      const typedFacet = FunctionFacet.with(spec)
      const typedType = typedFacet.type()

      const func: Function<typeof schema, typeof returnType> = {
        parameters: schema,
        returnType,
        effects,
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

      const identicalShapeSpec = { parameters: schema, returnType, effects }
      assert.strictEqual(typedFacet.is(FunctionFacet.with(identicalShapeSpec)), false)

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
    it('should format as facet name with field names', () => {
      const recordFacet = RecordFacet.with({ gain: NumberFacet.type(), label: StringFacet.type() })
      assert.strictEqual(recordFacet.format(), 'record(gain, label)')
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

    it('should create a single-facet type', () => {
      const stringType = StringFacet.type()
      assert.deepStrictEqual([...stringType.facets.keys()], ['string'])
    })
  })
})
