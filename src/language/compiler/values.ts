import type { Bus, Instrument, Numeric, Pattern, Unit } from '../../core/program.js'
import { CompileError } from './error.js'
import type { FunctionDefinition } from './functions.js'
import type { PropertySchema } from './schema.js'

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

export interface FunctionValue<S extends PropertySchema = PropertySchema, R extends TypeInfo = TypeInfo> extends AnyValue {
  readonly type: 'Function'
  readonly value: FunctionDefinition<S, R>
}

export interface InstrumentValue extends AnyValue {
  readonly type: 'Instrument'
  readonly value: Instrument
}

export interface BusValue extends AnyValue {
  readonly type: 'Bus'
  readonly value: Bus
}

type RoutableValue = InstrumentValue | BusValue

export interface GroupValue {
  readonly type: 'Group'
  readonly value: readonly RoutableValue[]
}

export type Value =
  StringValue |
  NumberValue |
  PatternValue |
  FunctionValue |
  InstrumentValue |
  BusValue |
  GroupValue

// Type Information

export type ValueType = Value['type']

export interface TypeInfo {
  readonly type: ValueType
  readonly unit?: Unit
  readonly schema?: PropertySchema
  readonly returnType?: TypeInfo
}

export type ValueForType<T extends ValueType> =
  T extends 'String' ? StringValue
    : T extends 'Number' ? NumberValue
      : T extends 'Pattern' ? PatternValue
        : T extends 'Function' ? FunctionValue
          : T extends 'Instrument' ? InstrumentValue
            : T extends 'Bus' ? BusValue
              : T extends 'Group' ? GroupValue
                : never

export type ValueForTypeInfo<T extends TypeInfo> =
  T['type'] extends 'Number'
    ? NumberValue<T['unit']>
    : T['type'] extends 'Function'
      ? FunctionValue<T['schema'] extends PropertySchema ? T['schema'] : PropertySchema, T['returnType'] extends TypeInfo ? T['returnType'] : TypeInfo>
      : ValueForType<T['type']>

export function typeOf (value: Value): TypeInfo {
  switch (value.type) {
    case 'String':
      return { type: 'String' }
    case 'Number':
      return { type: 'Number', unit: value.value.unit }
    case 'Pattern':
      return { type: 'Pattern' }
    case 'Function':
      return { type: 'Function', schema: value.value.arguments, returnType: value.value.returnType }
    case 'Instrument':
      return { type: 'Instrument' }
    case 'Bus':
      return { type: 'Bus' }
    case 'Group':
      return { type: 'Group' }
  }
}

export function areTypesEqual (a: TypeInfo, b: TypeInfo): boolean {
  if (a.type !== b.type) return false
  switch (a.type) {
    case 'Number':
      return a.unit === (b as any).unit
    default:
      return true
  }
}

export function formatType (t: TypeInfo): string {
  switch (t.type) {
    case 'String':
      return 'string'
    case 'Number':
      return t.unit != null ? `number<${t.unit}>` : 'number'
    case 'Pattern':
      return 'pattern'
    case 'Function':
      return 'function'
    case 'Instrument':
      return 'instrument'
    case 'Bus':
      return 'bus'
    case 'Group':
      return 'group'
  }
}

// Factory

export function makeValue<T extends ValueType> (type: T, value: ValueForType<T>['value']): ValueForType<T> {
  return { type, value } as ValueForType<T>
}

export function makeString (value: string): StringValue {
  return makeValue('String', value)
}

export function makeNumber<const U extends Unit> (unit: U, value: number): NumberValue<U> {
  return makeValue('Number', { unit, value }) as NumberValue<U>
}

export function makePattern (value: Pattern): PatternValue {
  return makeValue('Pattern', value)
}

export function makeFunction<const S extends PropertySchema, const R extends TypeInfo> (value: FunctionDefinition<S, R>): FunctionValue<S, R> {
  return makeValue('Function', value) as FunctionValue<S, R>
}

export function makeInstrument (value: Instrument): InstrumentValue {
  return makeValue('Instrument', value)
}

export function makeBus (value: Bus): BusValue {
  return makeValue('Bus', value)
}

export function makeGroup (value: readonly RoutableValue[]): GroupValue {
  return { type: 'Group', value }
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

export function asFunction (value: Value): FunctionValue {
  return asValueType('Function', value)
}

export function asInstrument (value: Value): InstrumentValue {
  return asValueType('Instrument', value)
}

export function asBus (value: Value): BusValue {
  return asValueType('Bus', value)
}

export function asGroup (value: Value): GroupValue {
  return asValueType('Group', value)
}
