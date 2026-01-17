import type { Bus, Effect, Instrument, Numeric, Pattern, Section, Unit } from '@core/program.js'
import type { FunctionDefinition } from './functions.js'
import type { PropertySchema } from './schema.js'
import type { ModuleDefinition } from './modules.js'

export interface AnyValue<D = unknown> {
  readonly type: Type
  readonly data: D
}

export interface Type<T extends string = string, Generics extends object = object, V extends AnyValue = AnyValue> {
  readonly name: T
  readonly generics?: Generics

  format (): string
  equals (other: Type): other is Type<T, Generics, V>

  of (data: V['data']): V
  is (value: AnyValue): value is V
  cast (value: AnyValue): V
}

// Helpers

function defaultFormat (this: Type): string {
  return this.name
}

function defaultEquals<T extends string, G extends object, V extends AnyValue> (this: Type<T, G, V>, other: Type): other is Type<T, G, V> {
  return other.name === this.name
}

function makeType<const T extends string, const G extends object, V extends AnyValue> (name: T, generics?: G, overrides?: {
  format?: (this: Type<T, G, V>) => string
  equals?: (this: Type<T, G, V>, other: Type) => other is Type<T, G, V>
}): Type<T, G, V> {
  return {
    name,
    generics,

    format: overrides?.format ?? defaultFormat,
    equals: overrides?.equals ?? defaultEquals,

    of (data) {
      return { type: this, data } as any as V
    },

    is (value): value is V {
      return this.equals(value.type)
    },

    cast (value) {
      if (!this.is(value)) {
        throw new TypeError(`Cannot cast value of type ${value.type.format()} to type ${this.format()}`)
      }
      return value
    }
  }
}

// Specific types

export type Value = |
  ModuleValue |
  FunctionValue |
  NumberValue |
  StringValue |
  PatternValue |
  InstrumentValue |
  SectionValue |
  EffectValue |
  BusValue |
  GroupValue

export type ModuleValue = AnyValue<ModuleDefinition>
export type FunctionValue<S extends PropertySchema = PropertySchema, R extends Type = Type> = AnyValue<FunctionDefinition<S, R>>
export type NumberValue<U extends Unit = Unit> = AnyValue<Numeric<U>>
export type StringValue = AnyValue<string>
export type PatternValue = AnyValue<Pattern>
export type InstrumentValue = AnyValue<Instrument>
export type SectionValue = AnyValue<Section>
export type EffectValue = AnyValue<Effect>
export type BusValue = AnyValue<Bus>
export type GroupValue = AnyValue<ReadonlyArray<InstrumentValue | BusValue>>

export type ValueFor<T extends Type> = ReturnType<T['of']>

export const ModuleType = {
  ...makeType<'module', {}, ModuleValue>('module'),

  // override for better inference
  of: (data: ModuleDefinition): ModuleValue => ({
    type: ModuleType.with({ definition: data }),
    data
  }),

  with: (generics: Readonly<{ definition: ModuleDefinition }>) => {
    return makeType<'module', typeof generics, ModuleValue>('module', generics, {
      format () {
        return `module("${this.generics?.definition.name}")`
      },

      equals (other: Type): other is Type<'module', Readonly<{ definition: ModuleDefinition }>, ModuleValue> {
        return other.name === 'module' && ModuleType.detail(other).definition === generics.definition
      }
    })
  },

  detail: (type: Type): Readonly<{ definition?: ModuleDefinition }> => {
    return type.generics as Readonly<{ definition?: ModuleDefinition }>
  }
}

export const FunctionType = {
  ...makeType<'function', {}, FunctionValue>('function'),

  // override for better inference
  of: <const S extends PropertySchema, const R extends Type> (data: FunctionDefinition<S, R>): FunctionValue<S, R> => ({
    type: FunctionType.with({ schema: data.arguments, returnType: data.returnType }),
    data
  }),

  with: <const S extends PropertySchema, const R extends Type> (generics: Readonly<{ schema: S, returnType: R }>) => {
    return makeType<'function', typeof generics, FunctionValue<S, R>>('function', generics)
  },

  detail: (type: Type): Readonly<{ schema?: PropertySchema, returnType?: Type }> => {
    return type.generics as Readonly<{ schema?: PropertySchema, returnType?: Type }>
  }
}

export const NumberType = {
  ...makeType<'number', {}, NumberValue>('number'),

  // override for better inference
  of: <const U extends Unit> (data: Numeric<U>): NumberValue<U> => ({
    type: NumberType.with(data.unit),
    data
  }),

  with: <const U extends Unit> (unit: U) => {
    return makeType<'number', { readonly unit: U }, NumberValue<U>>('number', { unit }, {
      format () {
        return this.generics?.unit == null ? 'number' : `number(${this.generics.unit})`
      },

      equals (other: Type): other is Type<'number', { readonly unit: U }, NumberValue<U>> {
        return other.name === 'number' && NumberType.detail(other).unit === unit
      }
    })
  },

  detail: (type: Type): Readonly<{ unit: Unit | undefined }> => {
    return type.generics as Readonly<{ unit: Unit | undefined }>
  }
}

export const StringType = makeType<'string', {}, StringValue>('string')
export const PatternType = makeType<'pattern', {}, PatternValue>('pattern')
export const InstrumentType = makeType<'instrument', {}, InstrumentValue>('instrument')
export const SectionType = makeType<'section', {}, SectionValue>('section')
export const EffectType = makeType<'effect', {}, EffectValue>('effect')
export const BusType = makeType<'bus', {}, BusValue>('bus')
export const GroupType = makeType<'group', {}, GroupValue>('group')
