import { applyInstruction } from '../instructions/index.ts'
import type { Instruction } from '../types.ts'

const tags = Object.freeze({
  Map: '%Map%',
  Set: '%Set%'
})

const replacer = (key: string, value: unknown) => {
  if (value instanceof Map) {
    return { [tags.Map]: Array.from(value) }
  }

  if (value instanceof Set) {
    return { [tags.Set]: Array.from(value) }
  }

  return value
}

const reviver = (key: string, value: unknown) => {
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

export function serialize (result: object, instructions: readonly Instruction[]): string {
  let object = result
  for (const instruction of instructions) {
    object = applyInstruction(object, instruction)
  }

  return JSON.stringify(object, replacer, 2)
}

export function deserialize (json: string): object {
  return JSON.parse(json, reviver)
}
