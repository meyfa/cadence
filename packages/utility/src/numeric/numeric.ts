export type Unit = string | undefined

// Enforce that only literal strings can be used as units,
// to prevent accidental widening to `string`.
type LiteralString<S extends string> = string extends S ? never : S
type LiteralUnit<U extends Unit> = U extends string ? LiteralString<U> : U

export type Numeric<U extends Unit> = number & { readonly __unit: U }

export interface RuntimeNumeric<U extends Unit> {
  readonly unit: U
  readonly value: Numeric<U>
}

export function runtimeNumeric<const U extends Unit> (unit: LiteralUnit<U>, value: number): RuntimeNumeric<U> {
  return { unit, value: value as Numeric<U> }
}
