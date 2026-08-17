import type { InstructionType } from './instructions/index.ts'

export type FixtureCompute = (fixture: Pick<Fixture, 'name' | 'source'>) => object
export type PostProcessor = (json: string) => string
export type InstructionExtractor = (input: string) => readonly Instruction[]

export interface FixtureOptions {
  readonly directory: URL

  readonly inputFileSuffix: string
  readonly outputFileSuffix: string

  readonly compute: FixtureCompute
  readonly postProcess?: PostProcessor

  readonly instructionExtractor?: InstructionExtractor
}

export interface Fixture {
  readonly name: string
  readonly source: string
  readonly expected: object
  readonly instructions: readonly Instruction[]
}

export interface Instruction {
  readonly type: InstructionType
  readonly argument?: object
}
