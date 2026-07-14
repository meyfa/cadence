import { CompileError } from './error.ts'

const FAILURE_MESSAGE = 'Internal compiler error (should have been caught in semantic analysis)'

/**
 * Throw a CompileError with the provided message or a default message.
 */
export function fail (message = FAILURE_MESSAGE): never {
  throw new CompileError(message)
}

/**
 * Assert that a condition is true, throwing a CompileError if it is false.
 */
export function assert (condition: boolean, message = FAILURE_MESSAGE): asserts condition {
  if (!condition) {
    fail(message)
  }
}

/**
 * Assert that a value is of type `never`. Note that `never` means the value should not exist,
 * so in fact, this function will always throw an error, as it should not have been possible to call it.
 */
export function assertNever (value: never, message = FAILURE_MESSAGE): never {
  fail(message)
}

/**
 * Convert a value to a non-nullable type, throwing a CompileError if the value is null or undefined.
 */
export function nonNull<T> (value: T | null | undefined, message = FAILURE_MESSAGE): NonNullable<T> {
  assert(value != null, message)
  return value
}
