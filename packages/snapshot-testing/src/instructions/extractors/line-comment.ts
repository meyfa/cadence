import assert from 'node:assert'
import type { Instruction, InstructionExtractor } from '../../types.ts'
import { isInstructionType } from '../index.ts'

/**
 * An instruction extractor that scans each line, and if it begins with the prefix "// test:",
 * extracts the remainder as an instruction.
 */
export const fromLineComment: InstructionExtractor = (input) => {
  const instructions: Instruction[] = []

  for (const line of input.split('\n')) {
    const match = /^\/\/\s*test:\s*([a-zA-Z0-9_-]+)\s*(.*)$/.exec(line)
    if (match == null) {
      continue
    }

    const [, type, argument] = match

    assert.ok(isInstructionType(type), `Invalid instruction type: ${JSON.stringify(type)}`)

    instructions.push({
      type,
      argument: argument.trim().length > 0 ? JSON.parse(argument) : undefined
    })
  }

  return instructions
}
