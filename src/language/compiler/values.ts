import type { Instrument, Numeric, Pattern, Unit } from '../../core/program.js'
import { CompileError } from '../error.js'

export interface AnyValue {
  readonly type: string
  readonly value: unknown
}

export interface StringValue extends AnyValue {
  readonly type: 'String'
  readonly value: string
}

export interface NumberValue<U extends Unit = Unit> extends AnyValue {
  readonly type: 'Number'
  readonly value: Numeric<U>
}

export interface PatternValue extends AnyValue {
  readonly type: 'Pattern'
  readonly value: Pattern
}

export interface InstrumentValue extends AnyValue {
  readonly type: 'Instrument'
  readonly value: Instrument
}

export type Value = StringValue | NumberValue | PatternValue | InstrumentValue

export type ValueType = Value['type']

export type ValueForType<T extends ValueType> =
  T extends 'String' ? StringValue
    : T extends 'Number' ? NumberValue
      : T extends 'Pattern' ? PatternValue
        : T extends 'Instrument' ? InstrumentValue
          : never

export type Underlying<T extends ValueType> = ValueForType<T>['value']

// Type Information

export interface TypeInfo {
  readonly type: ValueType
  readonly unit?: Unit
}

export function typeOf (value: Value): TypeInfo {
  return value.type === 'Number'
    ? { type: value.type, unit: value.value.unit }
    : { type: value.type }
}

export function areTypesEqual (a: TypeInfo, b: TypeInfo): boolean {
  return a.type === b.type && (a.type !== 'Number' || a.unit === b.unit)
}

export function formatType (type: TypeInfo): string {
  return type.unit != null
    ? `${type.type}<${type.unit}>`
    : type.type
}

// Factory

export function makeValue<T extends ValueType> (type: T, value: Underlying<T>): ValueForType<T> {
  return { type, value } as ValueForType<T>
}

export function makeString (value: string): StringValue {
  return makeValue('String', value)
}

export function makeNumber<U extends Unit> (unit: U, value: number): NumberValue<U> {
  return makeValue('Number', { unit, value }) as NumberValue<U>
}

export function makePattern (value: Pattern): PatternValue {
  return makeValue('Pattern', value)
}

export function makeInstrument (value: Instrument): InstrumentValue {
  return makeValue('Instrument', value)
}

// Casting

export function asValueType<T extends ValueType> (type: T, value: Value): ValueForType<T> {
  if (value.type !== type) {
    throw new CompileError(`Expected value of type ${type} but got ${value.type}`)
  }
  return value as ValueForType<T>
}

export function asString (value: Value): StringValue {
  return asValueType('String', value)
}

export function asNumber<U extends Unit> (unit: U, value: Value): NumberValue<U> {
  const numberValue = asValueType('Number', value)
  if (numberValue.value.unit !== unit) {
    throw new CompileError(`Expected number with unit ${unit} but got ${numberValue.value.unit ?? 'no unit'}`)
  }
  return numberValue as NumberValue<U>
}

export function asPattern (value: Value): PatternValue {
  return asValueType('Pattern', value)
}

export function asInstrument (value: Value): InstrumentValue {
  return asValueType('Instrument', value)
}
