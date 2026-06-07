import type { Type, ValueForType } from './types.js'

export interface Schema<Items extends readonly SchemaItem[] = readonly SchemaItem[]> {
  readonly items: Items
  readonly byName: ReadonlyMap<string, SchemaItem>
}

export interface SchemaItem<T extends Type = Type> {
  readonly name: string
  readonly type: T
  readonly required: boolean
}

export type InferSchema<S extends Schema> = {
  [P in S['items'][number] as P['required'] extends true ? P['name'] : never]: ValueForType<P['type']>
} & {
  [P in S['items'][number] as P['required'] extends false ? P['name'] : never]?: ValueForType<P['type']>
}

export function makeSchema<const Items extends readonly SchemaItem[]> (items: Items): Schema<Items> {
  const byName = new Map<string, SchemaItem>(
    items.map((item) => [item.name, item])
  )

  if (byName.size !== items.length) {
    throw new Error('Duplicate item names in schema')
  }

  return { items, byName }
}
