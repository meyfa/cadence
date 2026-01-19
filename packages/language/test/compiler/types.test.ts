/* eslint-disable @typescript-eslint/no-unused-vars */

import { makeNumeric, type ParameterId } from '@core/program.js'
import type { ModuleDefinition } from '@language/compiler/modules.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { BusType, BusValue, EffectType, type EffectValue, FunctionType, type FunctionValue, GroupType, type GroupValue, InstrumentType, type InstrumentValue, ModuleType, type ModuleValue, NumberType, type NumberValue, ParameterType, type ParameterValue, PartType, type PartValue, PatternType, type PatternValue, StringType, type StringValue, type Value, type ValueFor } from '../../src/compiler/types.js'
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
      const moduleType1 = ModuleType.with({ definition: testModuleDefinition })
      const moduleType2 = ModuleType.with({ definition: testModuleDefinition })

      assert.strictEqual(moduleType1.equals(moduleType2), true)

      const differentModuleDefinition: ModuleDefinition = {
        name: 'differentModule',
        exports: new Map<string, Value>([
          ['baz', NumberType.with('hz').of({ unit: 'hz', value: 440 })]
        ])
      }

      const moduleType3 = ModuleType.with({ definition: differentModuleDefinition })

      assert.strictEqual(moduleType1.equals(moduleType3), false)
    })

    it('should compare all function types equal', () => {
      const funcType1 = FunctionType.with({
        schema: [{ name: 'arg1', type: NumberType, required: true }],
        returnType: StringType
      })

      const funcType2 = FunctionType.with({
        schema: [
          { name: 'arg1', type: NumberType, required: true },
          { name: 'arg2', type: StringType, required: false }
        ],
        returnType: PatternType
      })

      assert.strictEqual(funcType1.equals(funcType2), true)
    })

    it('should compare number types with same generics equal', () => {
      const numType1 = NumberType.with(undefined)
      const numType2 = NumberType.with(undefined)
      const numType3 = NumberType.with('s')
      const numType4 = NumberType.with('s')
      assert.strictEqual(numType1.equals(numType2), true)
      assert.strictEqual(numType3.equals(numType4), true)
    })

    it('should compare number types with different generics unequal', () => {
      const numType1 = NumberType.with(undefined)
      const numType2 = NumberType.with('s')
      const numType3 = NumberType.with('hz')
      assert.strictEqual(numType1.equals(numType2), false)
      assert.strictEqual(numType2.equals(numType3), false)
    })

    it('should compare parameter types based on unit', () => {
      const paramType1 = ParameterType.with('db')
      const paramType2 = ParameterType.with('db')
      const paramType3 = ParameterType.with('s')
      assert.strictEqual(paramType1.equals(paramType2), true)
      assert.strictEqual(paramType1.equals(paramType3), false)
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
      const funcValue = FunctionType.of({
        arguments: [
          { name: 'arg1', type: NumberType, required: true }
        ],
        returnType: StringType,
        invoke: () => StringType.of('')
      })

      assert.strictEqual(FunctionType.is(funcValue), true)
    })

    it('should identify number values correctly', () => {
      const numValue = NumberType.of({ unit: 's', value: 10 })
      assert.strictEqual(NumberType.is(numValue), true)
      assert.strictEqual(NumberType.with('s').is(numValue), true)
      assert.strictEqual(NumberType.with(undefined).is(numValue), false)
      assert.strictEqual(NumberType.with('hz').is(numValue), false)
    })

    it('should identify parameter values correctly', () => {
      const paramValue = ParameterType.of({
        id: 42 as ParameterId,
        initial: makeNumeric('db', -6)
      })
      assert.strictEqual(ParameterType.is(paramValue), true)
      assert.strictEqual(ParameterType.with('db').is(paramValue), true)
      assert.strictEqual(ParameterType.with(undefined).is(paramValue), false)
      assert.strictEqual(ParameterType.with('s').is(paramValue), false)
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
      const moduleValue: Value = ModuleType.of(testModuleDefinition)

      const castedModule = ModuleType.cast(moduleValue)
      expectTypeEquals<ModuleValue, typeof castedModule>()
      assert.strictEqual(castedModule, moduleValue)
    })

    it('should cast function values correctly', () => {
      const funcValue: Value = FunctionType.of({
        arguments: [],
        returnType: StringType,
        invoke: () => StringType.of('')
      })

      const castedFunc = FunctionType.cast(funcValue)
      expectTypeEquals<FunctionValue, typeof castedFunc>()
      assert.strictEqual(castedFunc, funcValue)
    })

    it('should cast number values correctly', () => {
      const numValue: Value = NumberType.of({ unit: 's', value: 10 })

      const castedNum = NumberType.cast(numValue)
      expectTypeEquals<NumberValue, typeof castedNum>()
      assert.strictEqual(castedNum, numValue)

      const castedNumWithGenerics = NumberType.with('s').cast(numValue)
      expectTypeEquals<NumberValue<'s'>, typeof castedNumWithGenerics>()
      assert.strictEqual(castedNumWithGenerics, numValue)
    })

    it('should cast parameter values correctly', () => {
      const paramValue: Value = ParameterType.of({
        id: 42 as ParameterId,
        initial: makeNumeric('db', -3)
      })

      const castedParam = ParameterType.cast(paramValue)
      expectTypeEquals<ParameterValue, typeof castedParam>()
      assert.strictEqual(castedParam, paramValue)

      const castedParamWithGenerics = ParameterType.with('db').cast(paramValue)
      expectTypeEquals<ParameterValue<'db'>, typeof castedParamWithGenerics>()
      assert.strictEqual(castedParamWithGenerics, paramValue)
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
})
