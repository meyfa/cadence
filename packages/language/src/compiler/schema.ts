import type { SourceRange } from '@ast'
import type { AnyValue, Type, ValueFor } from './types.js'

export type Properties = readonly Property[]
export type AcceptedType = Type | readonly Type[]

export interface Property {
  readonly key: {
    readonly name: string
    readonly range: SourceRange
  }
  readonly value: {
    readonly range: SourceRange
  }
}

export type PropertySchema = readonly PropertySpec[]

export interface PropertySpec {
  readonly name: string
  readonly type: AcceptedType
  readonly required: boolean
}

type InferPropertyType<T extends AcceptedType> =
  T extends readonly Type[]
    ? ValueFor<T[number]> extends AnyValue ? ValueFor<T[number]>['data'] : never
    : T extends Type
      ? ValueFor<T> extends AnyValue ? ValueFor<T>['data'] : never
      : never

export type InferSchema<S extends PropertySchema> = {
  [P in S[number] as P['required'] extends true ? P['name'] : never]: InferPropertyType<P['type']>
} & {
  [P in S[number] as P['required'] extends false ? P['name'] : never]?: InferPropertyType<P['type']>
}

export function definePropertySchema<const T extends PropertySchema> (schema: T): T {
  return schema
}
