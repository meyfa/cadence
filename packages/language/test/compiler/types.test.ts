/* eslint-disable @typescript-eslint/no-unused-vars */

import type { ModuleDefinition } from '@language/compiler/modules.js'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { BusType, BusValue, FunctionType, type FunctionValue, GroupType, type GroupValue, InstrumentType, type InstrumentValue, ModuleType, type ModuleValue, NumberType, type NumberValue, PatternType, type PatternValue, StringType, type StringValue, type Value, type ValueFor } from '../../src/compiler/types.js'
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
      expectTypeEquals<InstrumentValue, ValueFor<typeof InstrumentType>>()
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

        const funcType = func.type
        assert.deepStrictEqual(funcType.generics, {
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

        const funcType = FunctionType.with(generics)
        assert.strictEqual(funcType.name, 'function')
        assert.deepStrictEqual(funcType.generics, generics)
      })

      it('should have correct format', () => {
        const generics = {
          schema: [
            { name: 'arg1', type: NumberType, required: true },
            { name: 'arg2', type: StringType, required: false }
          ],
          returnType: PatternType
        }

        const funcType = FunctionType.with(generics)
        assert.strictEqual(funcType.format(), 'function')
      })
    })

    describe('detail()', () => {
      it('should return generics', () => {
        const generics = {
          schema: [{ name: 'arg1', type: NumberType, required: true }],
          returnType: StringType
        }

        const funcType = FunctionType.with(generics)
        assert.deepStrictEqual(FunctionType.detail(funcType), generics)
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
        const funcType = NumberType.with(undefined)
        assert.strictEqual(funcType.name, 'number')
        assert.deepStrictEqual(funcType.generics, { unit: undefined })

        const funcType2 = NumberType.with('s')
        assert.strictEqual(funcType2.name, 'number')
        assert.deepStrictEqual(funcType2.generics, { unit: 's' })
      })

      it('should have correct format', () => {
        const funcType = NumberType.with(undefined)
        assert.strictEqual(funcType.format(), 'number')

        const funcType2 = NumberType.with('s')
        assert.strictEqual(funcType2.format(), 'number(s)')

        const funcType3 = NumberType.with('beats')
        assert.strictEqual(funcType3.format(), 'number(beats)')
      })
    })

    describe('detail()', () => {
      it('should return generics', () => {
        const funcType = NumberType.with(undefined)
        assert.deepStrictEqual(NumberType.detail(funcType), { unit: undefined })

        const funcType2 = NumberType.with('s')
        assert.deepStrictEqual(NumberType.detail(funcType2), { unit: 's' })
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

  describe('InstrumentType', () => {
    it('should have correct name, generics, format', () => {
      assert.strictEqual(InstrumentType.name, 'instrument')
      assert.strictEqual(InstrumentType.generics, undefined)
      assert.strictEqual(InstrumentType.format(), 'instrument')
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
