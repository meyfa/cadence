import type { Unit } from '@core/program.js'
import { literal, number, object, type Struct, type StructError } from 'superstruct'

export type StructValidation<T> = [StructError, undefined] | [undefined, T]

// https://github.com/ianstormtaylor/superstruct/issues/736
export function readonly<T, S> (struct: Struct<T, S>): Struct<Readonly<T>, S> {
  return struct
}

export const numeric = <const U extends Unit> (unit: U) => object({
  unit: literal(unit),
  value: number()
})
