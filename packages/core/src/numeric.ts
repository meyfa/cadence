export type Unit = string | undefined

// Enforce that only literal strings can be used as units,
// to prevent accidental widening to `string`.
type LiteralString<S extends string> = string extends S ? never : S
type LiteralUnit<U extends Unit> = U extends string ? LiteralString<U> : U

export interface Numeric<U extends Unit> {
  readonly unit: U
  readonly value: number
}

export function numeric<const U extends Unit> (unit: LiteralUnit<U>, value: number): Numeric<U> {
  return { unit, value }
}
