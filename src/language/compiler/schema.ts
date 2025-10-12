import type { SourceLocation } from '../location.js'
import { type NumberValue, type TypeInfo, type Underlying } from './values.js'

export type Properties = readonly Property[]

export interface Property {
  readonly key: {
    readonly name: string
    readonly source: SourceLocation
  }
  readonly value: {
    readonly location: SourceLocation
  }
}

export type PropertySchema = readonly PropertySpec[]

export interface PropertySpec {
  readonly name: string
  readonly type: TypeInfo
  readonly required: boolean
}

export type InferSchema<S extends PropertySchema> = {
  [P in S[number] as P['required'] extends true ? P['name'] : never]: ValueType<P>
} & {
  [P in S[number] as P['required'] extends false ? P['name'] : never]?: ValueType<P>
}

type ValueType<P extends PropertySpec> =
  P['type']['type'] extends 'Number'
    ? NumberValue<P['type']['unit']>['value']
    : Underlying<P['type']['type']>

export function definePropertySchema<const T extends PropertySchema> (schema: T): T {
  return schema
}
