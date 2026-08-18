import type { SerializationOptions } from '../types.ts'

const SPACE = '  '

const tags = Object.freeze({
  Map: '%Map%',
  Set: '%Set%'
})

const replacer = (key: string | undefined, value: unknown) => {
  if (value instanceof Map) {
    return { [tags.Map]: Array.from(value) }
  }

  if (value instanceof Set) {
    return { [tags.Set]: Array.from(value) }
  }

  return value
}

const reviver = (key: string | undefined, value: unknown) => {
  if (typeof value === 'object' && value != null) {
    const map = tags.Map in value ? value[tags.Map] : undefined
    if (Array.isArray(map)) {
      return new Map(map)
    }

    const set = tags.Set in value ? value[tags.Set] : undefined
    if (Array.isArray(set)) {
      return new Set(set)
    }
  }

  return value
}

function stringifyListLike (prefix: string, suffix: string, items: readonly string[], level: number, collapse: boolean): string {
  if (items.length === 0 || collapse) {
    return `${prefix}${items.join(', ')}${suffix}`
  }

  const indent = SPACE.repeat(level)
  return `${prefix}\n${items.map((item) => `${indent}${SPACE}${item}`).join(',\n')}\n${indent}${suffix}`
}

/**
 * Serialize the data similarly to JSON.stringify, but with support for some additional types (like Map and Set)
 * and with advanced formatting options (like collapsing certain properties onto a single line).
 *
 * Circular references are not supported.
 */
export function serialize (data: unknown, options?: SerializationOptions): string {
  const shouldCollapse = options?.shouldCollapse ?? (() => false)

  const stringify = (key: string | undefined, value: unknown, level: number, collapse = false): string | undefined => {
    collapse ||= shouldCollapse(key, value)

    if (value != null && (typeof value === 'object' || typeof value === 'function')) {
      const toJSON = (value as { toJSON?: (key: string) => unknown }).toJSON
      if (typeof toJSON === 'function') {
        value = toJSON.call(value, key ?? '')
      }
    }

    value = replacer(key, value)

    // non-serializable (undefined, function, symbol)
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
      return undefined
    }

    // primitive (string, number, boolean, null)
    // and boxed primitives (String, Number, Boolean)
    if (value === null || typeof value !== 'object' || value instanceof String || value instanceof Number || value instanceof Boolean) {
      return JSON.stringify(value)
    }

    // array
    if (Array.isArray(value)) {
      const items = Array.from(value, (value, key) => stringify(`${key}`, value, level + 1, collapse) ?? 'null')
      return stringifyListLike('[', ']', items, level, collapse)
    }

    // object
    const items = Object.entries(value)
      .map(([key, value]) => {
        const string = stringify(key, value, level + 1, collapse)
        return string == null ? undefined : `${JSON.stringify(key)}: ${string}`
      })
      .filter((item) => item != null)
    return stringifyListLike('{', '}', items, level, collapse)
  }

  return (stringify(undefined, data, 0) ?? 'null') + '\n'
}

/**
 * Deserialize data that was serialized using serialize(),
 * restoring any special types (like Map and Set) that were serialized.
 */
export function deserialize (json: string): unknown {
  return JSON.parse(json, reviver)
}
