/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

// Passes typechecking iff types X and Y are exactly equal (no arguments)
export function expectTypeEquals<X, Y> (..._args: [Equals<X, Y>] extends [true] ? [] : ['Types are not equal']): void {
  // no-op
}
