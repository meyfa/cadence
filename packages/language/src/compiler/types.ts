import type { Bus, Effect, Instrument, Numeric, Parameter, Part, Pattern, Unit } from '@core/program.js'
import type { Curve } from './curves.js'
import type { FunctionDefinition } from './functions.js'
import type { ModuleDefinition } from './modules.js'
import type { PropertySchema } from './schema.js'

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

  propertyType(this: Type, name: string): Type | undefined
  propertyValue(value: V, name: string): AnyValue | undefined
}

// Helpers

function defaultFormat (this: Type): string {
  return this.name
}

function defaultEquals<T extends string, G extends object, V extends AnyValue> (this: Type<T, G, V>, other: Type): other is Type<T, G, V> {
  return other.name === this.name
}

function defaultPropertyType (this: Type, _name: string): Type | undefined {
  return undefined
}

function defaultPropertyValue (this: Type, _value: AnyValue, _name: string): AnyValue | undefined {
  return undefined
}

function makeType<const T extends string, const G extends object, V extends AnyValue> (name: T, generics?: G, overrides?: {
  format?: (this: Type<T, G, V>) => string
  equals?: (this: Type<T, G, V>, other: Type) => other is Type<T, G, V>
  propertyType?: (this: Type<T, G, V>, name: string) => Type | undefined
  propertyValue?: (this: Type<T, G, V>, value: V, name: string) => AnyValue | undefined
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
    },

    propertyType: overrides?.propertyType ?? defaultPropertyType,
    propertyValue: overrides?.propertyValue ?? defaultPropertyValue
  }
}

// Specific types

export type Value = |
  ModuleValue |
  FunctionValue |
  NumberValue |
  StringValue |
  PatternValue |
  ParameterValue |
  CurveValue |
  InstrumentValue |
  PartValue |
  EffectValue |
  BusValue

export type ModuleValue = AnyValue<ModuleDefinition>
export type FunctionValue<S extends PropertySchema = PropertySchema, R extends Type = Type> = AnyValue<FunctionDefinition<S, R>>
export type NumberValue<U extends Unit = Unit> = AnyValue<Numeric<U>>
export type StringValue = AnyValue<string>
export type PatternValue = AnyValue<Pattern>
export type ParameterValue<U extends Unit = Unit> = AnyValue<Parameter<U>>
export type CurveValue<U extends Unit = Unit> = AnyValue<Curve<U>>
export type InstrumentValue = AnyValue<Instrument>
export type PartValue = AnyValue<Part>
export type EffectValue = AnyValue<Effect>
export type BusValue = AnyValue<Bus>

export type ValueFor<T extends Type> = ReturnType<T['of']>

function getModulePropertyType (this: Type, name: string): Type | undefined {
  return ModuleType.detail(this).definition?.exports.get(name)?.type
}

function getModulePropertyValue (this: Type, value: ModuleValue, name: string): AnyValue | undefined {
  return value.data.exports.get(name)
}

export const ModuleType = {
  ...makeType<'module', {}, ModuleValue>('module', undefined, {
    propertyType: getModulePropertyType,
    propertyValue: getModulePropertyValue
  }),

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
      },

      propertyType: getModulePropertyType,
      propertyValue: getModulePropertyValue
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

export const ParameterType = {
  ...makeType<'parameter', {}, ParameterValue>('parameter'),

  // override for better inference
  of: <const U extends Unit> (data: Parameter<U>): ParameterValue<U> => ({
    type: ParameterType.with(data.initial.unit),
    data
  }),

  with: <const U extends Unit> (unit: U) => {
    return makeType<'parameter', { readonly unit: U }, ParameterValue<U>>('parameter', { unit }, {
      format () {
        return this.generics?.unit == null ? 'parameter' : `parameter(${this.generics.unit})`
      },

      equals (other: Type): other is Type<'parameter', { readonly unit: U }, ParameterValue<U>> {
        return other.name === 'parameter' && ParameterType.detail(other).unit === unit
      }
    })
  },

  detail: (type: Type): Readonly<{ unit: Unit | undefined }> => {
    return type.generics as Readonly<{ unit: Unit | undefined }>
  }
}

export const CurveType = {
  ...makeType<'curve', {}, CurveValue>('curve'),

  // override for better inference
  of: <const U extends Unit> (data: Curve<U>): CurveValue<U> => ({
    type: CurveType.with(data.unit),
    data
  }),

  with: <const U extends Unit> (unit: U) => {
    return makeType<'curve', { readonly unit: U }, CurveValue<U>>('curve', { unit }, {
      format () {
        return this.generics?.unit == null ? 'curve' : `curve(${this.generics.unit})`
      },

      equals (other: Type): other is Type<'curve', { readonly unit: U }, CurveValue<U>> {
        return other.name === 'curve' && CurveType.detail(other).unit === unit
      }
    })
  },

  detail: (type: Type): Readonly<{ unit: Unit | undefined }> => {
    return type.generics as Readonly<{ unit: Unit | undefined }>
  }
}

export const InstrumentType = makeType<'instrument', {}, InstrumentValue>('instrument', undefined, {
  propertyType (name: string): Type | undefined {
    switch (name) {
      case 'gain':
        return ParameterType.with('db')
      default:
        return undefined
    }
  },

  propertyValue (value, name: string): AnyValue | undefined {
    switch (name) {
      case 'gain':
        return ParameterType.of(value.data.gain)
      default:
        return undefined
    }
  }
})

export const PartType = makeType<'part', {}, PartValue>('part')
export const EffectType = makeType<'effect', {}, EffectValue>('effect')
export const BusType = makeType<'bus', {}, BusValue>('bus')
