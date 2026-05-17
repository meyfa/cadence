/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

import type { Result, SuccessResult } from '../src/result/result.js'
import assert from 'node:assert'

export type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false

// Passes typechecking iff types X and Y are exactly equal (no arguments)
export function expectTypeEquals<X, Y> (..._args: [Equals<X, Y>] extends [true] ? [] : ['Types are not equal']): void {
  // no-op
}

export function assertResultComplete<TValue, TError extends Error> (
  result: Result<TValue, TError>
): asserts result is SuccessResult<TValue> {
  assert.ok(result.complete, result.complete ? undefined : result.error)
}
