import assert from 'node:assert'

export function getProperty (object: unknown, path: readonly string[]): unknown {
  let current: unknown = object

  for (const key of path) {
    assert.ok(typeof current === 'object' && current != null, `Cannot get property "${key}" of non-object value`)
    assert.ok(Object.hasOwn(current, key), `Property "${key}" does not exist on object`)
    current = (current as Record<string, unknown>)[key]
  }

  return current as object
}
