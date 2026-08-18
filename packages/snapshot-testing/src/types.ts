import type { InstructionType } from './instructions/index.ts'

export type FixtureCompute = (fixture: Pick<Fixture, 'name' | 'source'>) => object
export type InstructionExtractor = (input: string) => readonly Instruction[]

export interface FixtureOptions {
  readonly directory: URL

  readonly inputFileSuffix: string
  readonly outputFileSuffix: string

  readonly compute: FixtureCompute
  readonly serialization?: SerializationOptions

  readonly instructionExtractor?: InstructionExtractor
}

export interface SerializationOptions {
  readonly shouldCollapse?: (key: string | undefined, value: unknown) => boolean
}

export interface Fixture {
  readonly name: string
  readonly source: string
  readonly expected: unknown
  readonly instructions: readonly Instruction[]
}

export interface Instruction {
  readonly type: InstructionType
  readonly argument?: unknown
}
