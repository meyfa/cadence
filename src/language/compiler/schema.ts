import type { SourceLocation } from '../location.js'
import { type AnyValue, type Type, type ValueFor } from './types.js'

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
  readonly type: Type
  readonly required: boolean
}

export type InferSchema<S extends PropertySchema> = {
  [P in S[number] as P['required'] extends true ? P['name'] : never]: ValueFor<P['type']> extends AnyValue ? ValueFor<P['type']>['data'] : never
} & {
  [P in S[number] as P['required'] extends false ? P['name'] : never]?: ValueFor<P['type']> extends AnyValue ? ValueFor<P['type']>['data'] : never
}

export function definePropertySchema<const T extends PropertySchema> (schema: T): T {
  return schema
}
