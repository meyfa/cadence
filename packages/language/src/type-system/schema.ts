import type { Type, ValueForType } from './types.js'

export type Schema = readonly SchemaItem[]

export interface SchemaItem<T extends Type = Type> {
  readonly name: string
  readonly type: T
  readonly required: boolean
}

export type InferSchema<S extends Schema> = {
  [P in S[number] as P['required'] extends true ? P['name'] : never]: ValueForType<P['type']>
} & {
  [P in S[number] as P['required'] extends false ? P['name'] : never]?: ValueForType<P['type']>
}

export function makeSchema<const S extends Schema> (schema: S): S {
  return schema
}
