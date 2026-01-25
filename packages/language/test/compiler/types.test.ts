/* eslint-disable @typescript-eslint/no-unused-vars */

import { makeNumeric, type ParameterId } from '@core/program.js'
import type { ModuleDefinition } from '@language/compiler/modules.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { BusType, BusValue, CurveType, type CurveValue, EffectType, type EffectValue, FunctionType, type FunctionValue, GroupType, type GroupValue, InstrumentType, type InstrumentValue, ModuleType, type ModuleValue, NumberType, type NumberValue, ParameterType, type ParameterValue, PartType, PartValue, PatternType, type PatternValue, StringType, type StringValue, type Value, type ValueFor } from '../../src/compiler/types.js'
import { expectTypeEquals } from '../test-utils.js'

describe('compiler/types.ts', () => {
  const testModuleDefinition: ModuleDefinition = {
    name: 'testModule',
    exports: new Map<string, Value>([
      ['foo', NumberType.with('s').of({ unit: 's', value: 10 })],
      ['bar', StringType.of('hello')]
    ])
  }

  describe('ValueFor', () => {
    it('should yield correct basic types', () => {
      expectTypeEquals<ModuleValue, ValueFor<typeof ModuleType>>()
      expectTypeEquals<FunctionValue, ValueFor<typeof FunctionType>>()
      expectTypeEquals<NumberValue, ValueFor<typeof NumberType>>()
      expectTypeEquals<StringValue, ValueFor<typeof StringType>>()
      expectTypeEquals<PatternValue, ValueFor<typeof PatternType>>()
      expectTypeEquals<ParameterValue, ValueFor<typeof ParameterType>>()
      expectTypeEquals<InstrumentValue, ValueFor<typeof InstrumentType>>()
      expectTypeEquals<PartValue, ValueFor<typeof PartType>>()
      expectTypeEquals<EffectValue, ValueFor<typeof EffectType>>()
      expectTypeEquals<BusValue, ValueFor<typeof BusType>>()
      expectTypeEquals<GroupValue, ValueFor<typeof GroupType>>()
      expectTypeEquals<CurveValue, ValueFor<typeof CurveType>>()
    })

    it('should honor module generics', () => {
      const moduleWithExports = ModuleType.with({ definition: testModuleDefinition })
      expectTypeEquals<ModuleValue, ValueFor<typeof moduleWithExports>>()
    })

    it('should honor function generics', () => {
      const functionWithArgs = FunctionType.with({
        schema: [{ name: 'arg1', type: NumberType, required: true }],
        returnType: StringType
      })
      expectTypeEquals<FunctionValue<readonly [Readonly<{ name: 'arg1', type: typeof NumberType, required: true }>], typeof StringType>, ValueFor<typeof functionWithArgs>>()
    })

    it('should honor number generics', () => {
      const numberWithoutUnit = NumberType.with(undefined)
      expectTypeEquals<NumberValue<undefined>, ValueFor<typeof numberWithoutUnit>>()

      const numberWithUnit = NumberType.with('s')
      expectTypeEquals<NumberValue<'s'>, ValueFor<typeof numberWithUnit>>()
    })

    it('should honor parameter generics', () => {
      const parameterWithoutUnit = ParameterType.with(undefined)
      expectTypeEquals<ParameterValue<undefined>, ValueFor<typeof parameterWithoutUnit>>()

      const parameterWithUnit = ParameterType.with('db')
      expectTypeEquals<ParameterValue<'db'>, ValueFor<typeof parameterWithUnit>>()
    })

    it('should honor curve generics', () => {
      const curveWithoutUnit = CurveType.with(undefined)
      expectTypeEquals<CurveValue<undefined>, ValueFor<typeof curveWithoutUnit>>()

      const curveWithUnit = CurveType.with('db')
      expectTypeEquals<CurveValue<'db'>, ValueFor<typeof curveWithUnit>>()
    })
  })

  describe('Type::equals()', () => {
    it('should compare basic types correctly', () => {
      assert.strictEqual(FunctionType.equals(FunctionType), true)
      assert.strictEqual(FunctionType.equals(NumberType), false)

      assert.strictEqual(NumberType.equals(NumberType), true)
      assert.strictEqual(NumberType.equals(StringType), false)

      assert.strictEqual(StringType.equals(StringType), true)
      assert.strictEqual(StringType.equals(PatternType), false)
    })

    it('should compare module types based on definition', () => {
      const type1 = ModuleType.with({ definition: testModuleDefinition })
      const type2 = ModuleType.with({ definition: testModuleDefinition })

      assert.strictEqual(type1.equals(type2), true)

      const differentModuleDefinition: ModuleDefinition = {
        name: 'differentModule',
        exports: new Map<string, Value>([
          ['baz', NumberType.with('hz').of({ unit: 'hz', value: 440 })]
        ])
      }

      const moduleType3 = ModuleType.with({ definition: differentModuleDefinition })

      assert.strictEqual(type1.equals(moduleType3), false)
    })

    it('should compare all function types equal', () => {
      const type1 = FunctionType.with({
        schema: [{ name: 'arg1', type: NumberType, required: true }],
        returnType: StringType
      })

      const type2 = FunctionType.with({
        schema: [
          { name: 'arg1', type: NumberType, required: true },
          { name: 'arg2', type: StringType, required: false }
        ],
        returnType: PatternType
      })

      assert.strictEqual(type1.equals(type2), true)
    })

    it('should compare number types with same generics equal', () => {
      const type1 = NumberType.with(undefined)
      const type2 = NumberType.with(undefined)
      const type3 = NumberType.with('s')
      const type4 = NumberType.with('s')
      assert.strictEqual(type1.equals(type2), true)
      assert.strictEqual(type3.equals(type4), true)
    })

    it('should compare number types with different generics unequal', () => {
      const type1 = NumberType.with(undefined)
      const type2 = NumberType.with('s')
      const type3 = NumberType.with('hz')
      assert.strictEqual(type1.equals(type2), false)
      assert.strictEqual(type2.equals(type3), false)
    })

    it('should compare parameter types based on unit', () => {
      const type1 = ParameterType.with('db')
      const type2 = ParameterType.with('db')
      const type3 = ParameterType.with('s')
      assert.strictEqual(type1.equals(type2), true)
      assert.strictEqual(type1.equals(type3), false)
    })

    it('should compare curve types based on unit', () => {
      const type1 = CurveType.with('db')
      const type2 = CurveType.with('db')
      const type3 = CurveType.with('hz')
      assert.strictEqual(type1.equals(type2), true)
      assert.strictEqual(type1.equals(type3), false)
    })
  })

  describe('Type::is()', () => {
    it('should identify basic types correctly', () => {
      const strValue = StringType.of('hello')
      assert.strictEqual(StringType.is(strValue), true)
      assert.strictEqual(PatternType.is(strValue), false)
    })

    it('should identify module values correctly', () => {
      const type = ModuleType.with({ definition: testModuleDefinition })
      for (const value of [type.of(testModuleDefinition), ModuleType.of(testModuleDefinition)]) {
        assert.strictEqual(type.is(value), true)
        assert.strictEqual(ModuleType.is(value), true)
      }
    })

    it('should identify function values correctly', () => {
      const value = FunctionType.of({
        arguments: [
          { name: 'arg1', type: NumberType, required: true }
        ],
        returnType: StringType,
        invoke: () => StringType.of('')
      })

      assert.strictEqual(FunctionType.is(value), true)
    })

    it('should identify number values correctly', () => {
      const value = NumberType.of({ unit: 's', value: 10 })
      assert.strictEqual(NumberType.is(value), true)
      assert.strictEqual(NumberType.with('s').is(value), true)
      assert.strictEqual(NumberType.with(undefined).is(value), false)
      assert.strictEqual(NumberType.with('hz').is(value), false)
    })

    it('should identify parameter values correctly', () => {
      const value = ParameterType.of({
        id: 42 as ParameterId,
        initial: makeNumeric('db', -6)
      })
      assert.strictEqual(ParameterType.is(value), true)
      assert.strictEqual(ParameterType.with('db').is(value), true)
      assert.strictEqual(ParameterType.with(undefined).is(value), false)
      assert.strictEqual(ParameterType.with('s').is(value), false)
    })

    it('should identify curve values correctly', () => {
      const value = CurveType.of({
        type: 'linear',
        unit: 'db',
        start: makeNumeric('db', -6),
        end: makeNumeric('db', 0)
      })
      assert.strictEqual(CurveType.is(value), true)
      assert.strictEqual(CurveType.with('db').is(value), true)
      assert.strictEqual(CurveType.with(undefined).is(value), false)
      assert.strictEqual(CurveType.with('hz').is(value), false)
    })
  })

  describe('Type::cast()', () => {
    it('should cast basic types correctly', () => {
      const strValue: Value = StringType.of('hello')

      const castedStr = StringType.cast(strValue)
      expectTypeEquals<StringValue, typeof castedStr>()
      assert.strictEqual(castedStr, strValue)

      assert.throws(() => PatternType.cast(strValue), {
        message: 'Cannot cast value of type string to type pattern'
      })

      assert.throws(() => NumberType.with('s').cast(strValue), {
        message: 'Cannot cast value of type string to type number(s)'
      })
    })

    it('should cast module values correctly', () => {
      const value: Value = ModuleType.of(testModuleDefinition)

      const casted = ModuleType.cast(value)
      expectTypeEquals<ModuleValue, typeof casted>()
      assert.strictEqual(casted, value)
    })

    it('should cast function values correctly', () => {
      const value: Value = FunctionType.of({
        arguments: [],
        returnType: StringType,
        invoke: () => StringType.of('')
      })

      const casted = FunctionType.cast(value)
      expectTypeEquals<FunctionValue, typeof casted>()
      assert.strictEqual(casted, value)
    })

    it('should cast number values correctly', () => {
      const value: Value = NumberType.of({ unit: 's', value: 10 })

      const casted = NumberType.cast(value)
      expectTypeEquals<NumberValue, typeof casted>()
      assert.strictEqual(casted, value)

      const castedWithGenerics = NumberType.with('s').cast(value)
      expectTypeEquals<NumberValue<'s'>, typeof castedWithGenerics>()
      assert.strictEqual(castedWithGenerics, value)
    })

    it('should cast parameter values correctly', () => {
      const value: Value = ParameterType.of({
        id: 42 as ParameterId,
        initial: makeNumeric('db', -3)
      })

      const casted = ParameterType.cast(value)
      expectTypeEquals<ParameterValue, typeof casted>()
      assert.strictEqual(casted, value)

      const castedWithGenerics = ParameterType.with('db').cast(value)
      expectTypeEquals<ParameterValue<'db'>, typeof castedWithGenerics>()
      assert.strictEqual(castedWithGenerics, value)
    })
  })

  describe('ModuleType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(ModuleType.name, 'module')
      assert.strictEqual(ModuleType.generics, undefined)
      assert.strictEqual(ModuleType.format(), 'module')
    })

    describe('of()', () => {
      it('should narrow type correctly', () => {
        const moduleDef: ModuleDefinition = {
          name: 'myModule',
          exports: new Map<string, Value>()
        }

        const module = ModuleType.of(moduleDef)
        expectTypeEquals<ModuleValue, typeof module>()

        const moduleType = module.type
        assert.deepStrictEqual(moduleType.generics, { definition: moduleDef })
      })
    })

    describe('with()', () => {
      it('should set correct name and generics', () => {
        const generics = {
          definition: testModuleDefinition
        }

        const moduleType = ModuleType.with(generics)
        assert.strictEqual(moduleType.name, 'module')
        assert.deepStrictEqual(moduleType.generics, generics)
      })

      it('should have correct format', () => {
        const generics = {
          definition: testModuleDefinition
        }

        const moduleType = ModuleType.with(generics)
        assert.strictEqual(moduleType.format(), 'module("testModule")')
      })
    })

    describe('detail()', () => {
      it('should return generics', () => {
        const generics = {
          definition: testModuleDefinition
        }

        const moduleType = ModuleType.with(generics)
        assert.deepStrictEqual(ModuleType.detail(moduleType), generics)
      })
    })

    describe('propertyType()', () => {
      it('should return export types', () => {
        const moduleType = ModuleType.with({ definition: testModuleDefinition })

        const fooType = moduleType.propertyType('foo')
        assert.strictEqual(fooType?.format(), 'number(s)')

        const barType = moduleType.propertyType('bar')
        assert.strictEqual(barType?.format(), 'string')

        const bazType = moduleType.propertyType('baz')
        assert.strictEqual(bazType, undefined)
      })
    })

    describe('propertyValue()', () => {
      it('should return export values', () => {
        const moduleValue = ModuleType.of(testModuleDefinition)

        const fooValue = ModuleType.propertyValue(moduleValue, 'foo')
        assert.deepStrictEqual(fooValue?.data, NumberType.with('s').of({ unit: 's', value: 10 }).data)

        const barValue = ModuleType.propertyValue(moduleValue, 'bar')
        assert.deepStrictEqual(barValue?.data, StringType.of('hello').data)

        const bazValue = ModuleType.propertyValue(moduleValue, 'baz')
        assert.strictEqual(bazValue, undefined)
      })
    })
  })

  describe('FunctionType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(FunctionType.name, 'function')
      assert.strictEqual(FunctionType.generics, undefined)
      assert.strictEqual(FunctionType.format(), 'function')
    })

    describe('of()', () => {
      it('should narrow type correctly', () => {
        const generics = {
          arguments: [
            { name: 'arg1', type: NumberType, required: true },
            { name: 'arg2', type: StringType, required: false }
          ],
          returnType: StringType,
          invoke: () => StringType.of('')
        } as const

        const func = FunctionType.of(generics)
        expectTypeEquals<FunctionValue<typeof generics['arguments'], typeof generics['returnType']>, typeof func>()

        const type = func.type
        assert.deepStrictEqual(type.generics, {
          schema: generics.arguments,
          returnType: generics.returnType
        })
      })
    })

    describe('with()', () => {
      it('should set correct name and generics', () => {
        const generics = {
          schema: [{ name: 'arg1', type: NumberType, required: true }],
          returnType: StringType
        }

        const type = FunctionType.with(generics)
        assert.strictEqual(type.name, 'function')
        assert.deepStrictEqual(type.generics, generics)
      })

      it('should have correct format', () => {
        const generics = {
          schema: [
            { name: 'arg1', type: NumberType, required: true },
            { name: 'arg2', type: StringType, required: false }
          ],
          returnType: PatternType
        }

        const type = FunctionType.with(generics)
        assert.strictEqual(type.format(), 'function')
      })
    })

    describe('detail()', () => {
      it('should return generics', () => {
        const generics = {
          schema: [{ name: 'arg1', type: NumberType, required: true }],
          returnType: StringType
        }

        const type = FunctionType.with(generics)
        assert.deepStrictEqual(FunctionType.detail(type), generics)
      })
    })
  })

  describe('NumberType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(NumberType.name, 'number')
      assert.strictEqual(NumberType.generics, undefined)
      assert.strictEqual(NumberType.format(), 'number')
    })

    describe('of()', () => {
      it('should narrow type correctly', () => {
        const num1 = NumberType.of({ unit: undefined, value: 0 })
        expectTypeEquals<NumberValue<undefined>, typeof num1>()

        const num2 = NumberType.of({ unit: 's', value: 0 })
        expectTypeEquals<NumberValue<'s'>, typeof num2>()

        assert.deepStrictEqual(num1.type.generics, { unit: undefined })
        assert.deepStrictEqual(num2.type.generics, { unit: 's' })
      })
    })

    describe('with()', () => {
      it('should set correct name and generics', () => {
        const type = NumberType.with(undefined)
        assert.strictEqual(type.name, 'number')
        assert.deepStrictEqual(type.generics, { unit: undefined })

        const type2 = NumberType.with('s')
        assert.strictEqual(type2.name, 'number')
        assert.deepStrictEqual(type2.generics, { unit: 's' })
      })

      it('should have correct format', () => {
        const type = NumberType.with(undefined)
        assert.strictEqual(type.format(), 'number')

        const type2 = NumberType.with('s')
        assert.strictEqual(type2.format(), 'number(s)')

        const type3 = NumberType.with('beats')
        assert.strictEqual(type3.format(), 'number(beats)')
      })
    })

    describe('detail()', () => {
      it('should return generics', () => {
        const type = NumberType.with(undefined)
        assert.deepStrictEqual(NumberType.detail(type), { unit: undefined })

        const type2 = NumberType.with('s')
        assert.deepStrictEqual(NumberType.detail(type2), { unit: 's' })
      })
    })
  })

  describe('StringType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(StringType.name, 'string')
      assert.strictEqual(StringType.generics, undefined)
      assert.strictEqual(StringType.format(), 'string')
    })
  })

  describe('PatternType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(PatternType.name, 'pattern')
      assert.strictEqual(PatternType.generics, undefined)
      assert.strictEqual(PatternType.format(), 'pattern')
    })
  })

  describe('ParameterType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(ParameterType.name, 'parameter')
      assert.strictEqual(ParameterType.generics, undefined)
      assert.strictEqual(ParameterType.format(), 'parameter')
    })

    describe('of()', () => {
      it('should narrow type correctly', () => {
        const param1 = ParameterType.of({
          id: 1 as ParameterId,
          initial: makeNumeric(undefined, 0)
        })
        expectTypeEquals<ParameterValue<undefined>, typeof param1>()

        const param2 = ParameterType.of({
          id: 2 as ParameterId,
          initial: makeNumeric('db', -6)
        })
        expectTypeEquals<ParameterValue<'db'>, typeof param2>()

        assert.deepStrictEqual(param1.type.generics, { unit: undefined })
        assert.deepStrictEqual(param2.type.generics, { unit: 'db' })
      })
    })

    describe('with()', () => {
      it('should set correct name and generics', () => {
        const type = ParameterType.with(undefined)
        assert.strictEqual(type.name, 'parameter')
        assert.deepStrictEqual(type.generics, { unit: undefined })

        const type2 = ParameterType.with('db')
        assert.strictEqual(type2.name, 'parameter')
        assert.deepStrictEqual(type2.generics, { unit: 'db' })
      })

      it('should have correct format', () => {
        const type = ParameterType.with(undefined)
        assert.strictEqual(type.format(), 'parameter')

        const type2 = ParameterType.with('db')
        assert.strictEqual(type2.format(), 'parameter(db)')

        const type3 = ParameterType.with('s')
        assert.strictEqual(type3.format(), 'parameter(s)')
      })
    })

    describe('detail()', () => {
      it('should return generics', () => {
        const type = ParameterType.with(undefined)
        assert.deepStrictEqual(ParameterType.detail(type), { unit: undefined })

        const type2 = ParameterType.with('db')
        assert.deepStrictEqual(ParameterType.detail(type2), { unit: 'db' })
      })
    })
  })

  describe('InstrumentType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(InstrumentType.name, 'instrument')
      assert.strictEqual(InstrumentType.generics, undefined)
      assert.strictEqual(InstrumentType.format(), 'instrument')
    })

    describe('propertyType()', () => {
      it('should return property types', () => {
        const gainType = InstrumentType.propertyType('gain')
        assert.strictEqual(gainType?.name, 'parameter')
        assert.deepStrictEqual(gainType.generics, { unit: 'db' })
      })
    })

    describe('propertyValue()', () => {
      it('should return property values', () => {
        const instrumentValue = InstrumentType.of({
          id: 1 as any,
          sampleUrl: 'sample.wav',
          gain: {
            id: 2 as ParameterId,
            initial: makeNumeric('db', -3)
          },
          rootNote: undefined,
          length: undefined
        })

        const gainValue = InstrumentType.propertyValue(instrumentValue, 'gain')
        assert.deepStrictEqual(gainValue?.data, instrumentValue.data.gain)
      })
    })
  })

  describe('PartType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(PartType.name, 'part')
      assert.strictEqual(PartType.generics, undefined)
      assert.strictEqual(PartType.format(), 'part')
    })
  })

  describe('EffectType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(EffectType.name, 'effect')
      assert.strictEqual(EffectType.generics, undefined)
      assert.strictEqual(EffectType.format(), 'effect')
    })
  })

  describe('BusType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(BusType.name, 'bus')
      assert.strictEqual(BusType.generics, undefined)
      assert.strictEqual(BusType.format(), 'bus')
    })
  })

  describe('GroupType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(GroupType.name, 'group')
      assert.strictEqual(GroupType.generics, undefined)
      assert.strictEqual(GroupType.format(), 'group')
    })
  })

  describe('CurveType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(CurveType.name, 'curve')
      assert.strictEqual(CurveType.generics, undefined)
      assert.strictEqual(CurveType.format(), 'curve')
    })

    describe('of()', () => {
      it('should narrow type correctly', () => {
        const curve1 = CurveType.of({
          type: 'linear',
          unit: undefined,
          start: makeNumeric(undefined, 0),
          end: makeNumeric(undefined, 1)
        })
        expectTypeEquals<CurveValue<undefined>, typeof curve1>()

        const curve2 = CurveType.of({
          type: 'hold',
          unit: 'db',
          value: makeNumeric('db', -6)
        })
        expectTypeEquals<CurveValue<'db'>, typeof curve2>()

        assert.deepStrictEqual(curve1.type.generics, { unit: undefined })
        assert.deepStrictEqual(curve2.type.generics, { unit: 'db' })
      })
    })

    describe('with()', () => {
      it('should set correct name and generics', () => {
        const type = CurveType.with(undefined)
        assert.strictEqual(type.name, 'curve')
        assert.deepStrictEqual(type.generics, { unit: undefined })

        const type2 = CurveType.with('db')
        assert.strictEqual(type2.name, 'curve')
        assert.deepStrictEqual(type2.generics, { unit: 'db' })
      })

      it('should have correct format', () => {
        const type = CurveType.with(undefined)
        assert.strictEqual(type.format(), 'curve')

        const type2 = CurveType.with('db')
        assert.strictEqual(type2.format(), 'curve(db)')

        const type3 = CurveType.with('hz')
        assert.strictEqual(type3.format(), 'curve(hz)')
      })
    })

    describe('detail()', () => {
      it('should return generics', () => {
        const type = CurveType.with(undefined)
        assert.deepStrictEqual(CurveType.detail(type), { unit: undefined })

        const type2 = CurveType.with('db')
        assert.deepStrictEqual(CurveType.detail(type2), { unit: 'db' })
      })
    })
  })
})
