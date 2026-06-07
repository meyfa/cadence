import { CompileError } from './error.js'

const FAILURE_MESSAGE = 'Internal compiler error (should have been caught in semantic analysis)'

export function fail (message = FAILURE_MESSAGE): never {
  throw new CompileError(message)
}

export function assert (condition: boolean, message = FAILURE_MESSAGE): asserts condition {
  if (!condition) {
    fail(message)
  }
}

export function nonNull<T> (value: T | null | undefined, message = FAILURE_MESSAGE): NonNullable<T> {
  assert(value != null, message)
  return value
}
