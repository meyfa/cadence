import type { Unit } from '@core/program.js'
import { literal, number, object, string, type Struct, type StructError } from 'superstruct'

export type StructValidation<T> = [StructError, undefined] | [undefined, T]

// https://github.com/ianstormtaylor/superstruct/issues/736
export function readonly<T, S> (struct: Struct<T, S>): Struct<Readonly<T>, S> {
  return struct
}

export const numeric = <const U extends Unit> (unit: U) => object({
  unit: literal(unit),
  value: number()
})

export const brandedString = <T extends string> (): Struct<T & (string & { [K in keyof T]: T[K] }), null> => {
  return string() as unknown as Struct<T & (string & { [K in keyof T]: T[K] }), null>
}
