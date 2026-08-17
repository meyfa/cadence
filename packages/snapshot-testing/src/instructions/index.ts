import assert from 'node:assert'
import type { Instruction } from '../types.ts'
import { getProperty } from './types/get-property.ts'

const instructionTypes = Object.freeze([
  'get_property'
] as const)

export type InstructionType = typeof instructionTypes[number]

export function isInstructionType (type: string): type is InstructionType {
  return instructionTypes.includes(type as InstructionType)
}

export function applyInstruction (object: object, instruction: Instruction): object {
  switch (instruction.type) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    case 'get_property':
      assert.ok(Array.isArray(instruction.argument), 'get_property instruction requires an array argument')
      return getProperty(object, instruction.argument as readonly string[])
  }
}
