export type Unit = undefined | 'bpm' | 'steps' | 's' | 'hz' | 'db'

export interface Numeric<U extends Unit> {
  readonly unit: U
  readonly value: number
}

export function makeNumeric<U extends Unit> (unit: U, value: number): Numeric<U> {
  return { unit, value }
}

export type Note = `${'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'}${'' | '#' | 'b'}`
export type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type Pitch = `${Note}${Octave}`

export type Step = '-' | 'x' | Pitch
export type Pattern = readonly Step[]

export function isPitch (value: unknown): value is Pitch {
  return typeof value === 'string' && /^[A-G][#b]?(?:10|[0-9])$/.test(value)
}

type Id<Tag extends string> = number & { __tag: Tag }

// Domain types

export type InstrumentId = Id<'Instrument'>

export interface Instrument {
  readonly id: InstrumentId
  readonly sampleUrl: string
  readonly gain?: Numeric<'db'>
  readonly rootNote?: Pitch
  readonly length?: Numeric<'s'>
}

export interface Track {
  readonly tempo: Numeric<'bpm'>
  readonly sections: readonly Section[]
}

export interface Section {
  readonly name: string
  readonly length: Numeric<'steps'>
  readonly routings: readonly InstrumentRouting[]
}

export interface InstrumentRouting {
  readonly source: {
    readonly type: 'Pattern'
    readonly value: Pattern
  }

  readonly destination: {
    readonly type: 'Instrument'
    readonly id: InstrumentId
  }
}

export interface Mixer {
  readonly buses: readonly Bus[]
  readonly routings: readonly MixerRouting[]
}

export type BusId = Id<'Bus'>

export interface Bus {
  readonly id: BusId
  readonly name: string
  readonly gain?: Numeric<'db'>
}

export interface MixerRouting {
  readonly source: {
    readonly type: 'Instrument'
    readonly id: InstrumentId
  } | {
    readonly type: 'Bus'
    readonly id: BusId
  }

  readonly destination: {
    readonly type: 'Bus'
    readonly id: BusId
  }
}

// Top-level type

export interface Program {
  readonly beatsPerBar: number
  readonly stepsPerBeat: number

  readonly instruments: ReadonlyMap<InstrumentId, Instrument>
  readonly track: Track
  readonly mixer: Mixer
}
