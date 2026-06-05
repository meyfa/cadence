import type { Numeric } from '@utility'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { Function } from '../../src/type-system/base/function.js'
import { FunctionFacet } from '../../src/type-system/base/function.js'
import type { Module } from '../../src/type-system/base/module.js'
import { ModuleFacet } from '../../src/type-system/base/module.js'
import { NumberFacet } from '../../src/type-system/base/number.js'
import { RecordFacet } from '../../src/type-system/base/record.js'
import { StringFacet } from '../../src/type-system/base/string.js'
import { makeSchema } from '../../src/type-system/schema.js'
import type { ValueForType } from '../../src/type-system/types.js'
import { expectTypeEquals } from '../test-utils.js'

describe('type-system/base', () => {
  describe('StringFacet', () => {
    it('should format and round-trip string values', () => {
      const value = StringFacet.type().of('hello')

      assert.strictEqual(StringFacet.format(), 'string')
      assert.strictEqual(StringFacet.has(value), true)
      assert.strictEqual(StringFacet.get(value), 'hello')
    })
  })

  describe('NumberFacet', () => {
    it('should support unit-specific facets and detail()', () => {
      const genericValue = NumberFacet.type().of(numeric('db', -3))
      const decibelFacet = NumberFacet.with('db')
      const decibelType = decibelFacet.type()
      const decibelValue = decibelType.of(numeric('db', -3))
      const specificData = decibelFacet.get(decibelValue)

      expectTypeEquals<Numeric<'db'>, typeof specificData>()
      assert.strictEqual(NumberFacet.format(), 'number')
      assert.strictEqual(NumberFacet.with(undefined).format(), 'number')
      assert.strictEqual(decibelFacet.format(), 'number(db)')
      assert.strictEqual(NumberFacet.has(decibelValue), true)
      assert.strictEqual(decibelFacet.has(genericValue), false)
      assert.strictEqual(NumberFacet.detail(decibelType), 'db')
      assert.strictEqual(specificData.unit, 'db')
      assert.strictEqual(specificData.value, -3)
      assert.throws(() => NumberFacet.detail(NumberFacet.type()), /Invalid generics for number facet/)
    })
  })

  describe('FunctionFacet', () => {
    it('should preserve function specs through with() and detail()', () => {
      const amountType = NumberFacet.with('db').type()
      const returnType = StringFacet.type()
      const schema = makeSchema([
        { name: 'amount', type: amountType, required: true },
        { name: 'label', type: returnType, required: false }
      ])
      const spec = { parameters: schema, returnType }
      const typedFacet = FunctionFacet.with(spec)
      const typedType = typedFacet.type()

      const func: Function<typeof schema, typeof returnType> = {
        parameters: schema,
        returnType,
        invoke: (_context, args) => args.label ?? returnType.of('fallback'),
        summary: 'demo function'
      }

      const value = typedType.of(func)
      const loadedFunction = typedFacet.get(value)
      const result = loadedFunction.invoke(undefined, {
        amount: amountType.of(numeric('db', -6))
      })

      expectTypeEquals<Function<typeof schema, typeof returnType>, typeof loadedFunction>()
      expectTypeEquals<ValueForType<typeof returnType>, typeof result>()

      assert.strictEqual(typedFacet.format(), 'function')
      assert.strictEqual(typedFacet.is(FunctionFacet.with(spec)), true)

      const identicalShapeSpec = { parameters: schema, returnType }
      assert.strictEqual(typedFacet.is(FunctionFacet.with(identicalShapeSpec)), false)

      assert.strictEqual(FunctionFacet.detail(typedType), spec)
      assert.strictEqual(StringFacet.get(result), 'fallback')
      assert.throws(() => FunctionFacet.detail(FunctionFacet.type()), /Invalid generics for function facet/)
    })
  })

  describe('ModuleFacet', () => {
    it('should preserve module identity through with() and detail()', () => {
      const greeting = StringFacet.type().of('hello')
      const moduleValue: Module = {
        name: 'demo',
        exports: new Map([['greeting', greeting]]),
        summary: 'demo module'
      }

      const typedFacet = ModuleFacet.with(moduleValue)
      const typedType = typedFacet.type()
      const value = typedType.of(moduleValue)
      const loadedModule = typedFacet.get(value)

      expectTypeEquals<Module, typeof loadedModule>()
      assert.strictEqual(typedFacet.format(), 'module("demo")')
      assert.strictEqual(typedFacet.is(ModuleFacet.with(moduleValue)), true)
      assert.strictEqual(typedFacet.is(ModuleFacet.with({ ...moduleValue })), false)
      assert.strictEqual(ModuleFacet.detail(typedType), moduleValue)
      assert.strictEqual(loadedModule.exports.get('greeting'), greeting)
      assert.throws(() => ModuleFacet.detail(ModuleFacet.type()), /Invalid generics for module facet/)
    })
  })

  describe('RecordFacet', () => {
    it('should preserve field types and round-trip record values', () => {
      const gainType = NumberFacet.with('db').type()
      const labelType = StringFacet.type()
      const recordFacet = RecordFacet.with({ gain: gainType, label: labelType })
      const recordType = recordFacet.type()
      const recordValue = recordType.of({
        gain: gainType.of(numeric('db', -9)),
        label: labelType.of('lead')
      })
      const recordData = recordFacet.get(recordValue)

      expectTypeEquals<ValueForType<typeof gainType>, typeof recordData.gain>()
      expectTypeEquals<ValueForType<typeof labelType>, typeof recordData.label>()

      assert.strictEqual(RecordFacet.format(), 'record')
      assert.strictEqual(recordFacet.format(), 'record(gain, label)')
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
      const recordValue = recordType.of({ gain: NumberFacet.with('db').type().of(numeric('db', -9)) })
      const recordData = recordFacet.get(recordValue)

      assert.strictEqual(Object.getPrototypeOf(RecordFacet.detail(recordType)), null)
      assert.strictEqual(Object.getPrototypeOf(recordData), null)

      assert.strictEqual(RecordFacet.detail(recordType).__proto__, undefined)
      assert.strictEqual((recordData as Record<string, unknown>).constructor, undefined)

      const genericRecordType = RecordFacet.type()
      const genericRecordValue = genericRecordType.of({ gain: NumberFacet.with('db').type().of(numeric('db', -9)) })
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
})
