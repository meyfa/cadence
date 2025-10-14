import type { SourceLocation } from '../location.js'
import { type TypeInfo, type ValueForTypeInfo } from './values.js'

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
  [P in S[number] as P['required'] extends true ? P['name'] : never]: ValueForTypeInfo<P['type']>['value']
} & {
  [P in S[number] as P['required'] extends false ? P['name'] : never]?: ValueForTypeInfo<P['type']>['value']
}

export function definePropertySchema<const T extends PropertySchema> (schema: T): T {
  return schema
}
