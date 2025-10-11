export type Unit = undefined | 'bpm' | 'steps' | 's' | 'hz' | 'db'

export interface Numeric<U extends Unit> {
  readonly unit: U
  readonly value: number
}

export function makeNumeric<U extends Unit> (unit: U, value: number): Numeric<U> {
  return { unit, value }
}

export type Step = 'rest' | 'hit'
export type Pattern = readonly Step[]

type Id<Tag extends string> = number & { __tag: Tag }

// Domain types

export interface Track {
  readonly tempo: Numeric<'bpm'>
  readonly sections: readonly Section[]
}

export interface Section {
  readonly name: string
  readonly length: Numeric<'steps'>
  readonly routings: readonly Routing[]
}

export interface Routing {
  readonly instrumentId: InstrumentId
  readonly pattern: Pattern
}

export type InstrumentId = Id<'Instrument'>

export interface Instrument {
  readonly id: InstrumentId
  readonly sampleUrl: string
}

// Top-level type

export interface Program {
  readonly beatsPerBar: number
  readonly stepsPerBeat: number

  readonly instruments: ReadonlyMap<InstrumentId, Instrument>
  readonly track: Track
}
