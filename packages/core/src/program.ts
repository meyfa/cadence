export type Unit = undefined | 'bpm' | 'beats' | 's' | 'hz' | 'db'

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
export type StepValue = '-' | 'x' | Pitch

export interface Step {
  readonly value: StepValue

  /**
   * The duration of the step relative to the pattern's subdivision. Defaults to 1.
   */
  readonly length?: Numeric<undefined>

  /**
   * The gate (duration) of the step relative to the pattern's subdivision.
   * If undefined, the gate is equal to the step's length.
   */
  readonly gate?: Numeric<undefined>
}

export interface NoteEvent {
  readonly time: Numeric<'beats'>

  /**
   * The gate (duration) of the note event in beats. If undefined, the note is never released (held indefinitely),
   * and may or may not be cut off by subsequent notes depending on the instrument's behavior.
   */
  readonly gate?: Numeric<'beats'>

  /**
   * The pitch associated with the event. If undefined, indicates that the instrument's default pitch should be used.
   */
  readonly pitch?: Pitch
}

export interface Pattern {
  /**
   * The length of the pattern. This may be any non-negative value (not necessarily an integer).
   * If undefined, the pattern is infinite.
   */
  readonly length?: Numeric<'beats'>

  /**
   * Obtain all note events in the pattern, starting at time 0 and increasing monotonically.
   * It is up to the caller to stop iteration when desired (e.g. at a certain end time).
   */
  readonly evaluate: () => Iterable<NoteEvent>
}

export function isPitch (value: unknown): value is Pitch {
  return typeof value === 'string' && /^[A-G][#b]?(?:10|[0-9])$/.test(value)
}

export function isStepValue (value: unknown): value is StepValue {
  return value === '-' || value === 'x' || isPitch(value)
}

type Id<Tag extends string> = number & { __tag: Tag }

// Domain types

export type ParameterId = Id<'Parameter'>

export interface Parameter<U extends Unit> {
  readonly id: ParameterId
  readonly initial: Numeric<U>
}

export interface Automation<U extends Unit = Unit> {
  readonly parameterId: ParameterId
  readonly points: ReadonlyArray<AutomationPoint<U>>
}

export interface AutomationPoint<U extends Unit = Unit> {
  readonly time: Numeric<'beats'>
  readonly value: Numeric<U>

  /**
   * The curve from the previous point, or from the initial value, to this point.
   */
  readonly curve: 'linear' | 'step'
}

export type InstrumentId = Id<'Instrument'>

export interface Instrument {
  readonly id: InstrumentId
  readonly sampleUrl: string
  readonly gain: Parameter<'db'>
  readonly rootNote?: Pitch
  readonly length?: Numeric<'s'>
}

export interface Track {
  readonly tempo: Numeric<'bpm'>
  readonly parts: readonly Part[]
}

export interface Part {
  readonly name: string
  readonly length: Numeric<'beats'>
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
  readonly pan?: Numeric<undefined>
  readonly gain?: Numeric<'db'>
  readonly effects: readonly Effect[]
}

export type Effect =
  GainEffect |
  PanEffect |
  LowpassEffect |
  HighpassEffect |
  DelayEffect |
  ReverbEffect

export interface GainEffect {
  readonly type: 'gain'
  readonly gain: Numeric<'db'>
}

export interface PanEffect {
  readonly type: 'pan'
  readonly pan: Numeric<undefined>
}

export interface LowpassEffect {
  readonly type: 'lowpass'
  readonly frequency: Numeric<'hz'>
}

export interface HighpassEffect {
  readonly type: 'highpass'
  readonly frequency: Numeric<'hz'>
}

export interface DelayEffect {
  readonly type: 'delay'
  readonly time: Numeric<'beats'>
  readonly feedback: Numeric<undefined>
}

export interface ReverbEffect {
  readonly type: 'reverb'
  readonly decay: Numeric<'s'>
  readonly mix: Numeric<undefined>
}

export interface MixerRouting {
  readonly implicit: boolean

  readonly source: {
    readonly type: 'Instrument'
    readonly id: InstrumentId
  } | {
    readonly type: 'Bus'
    readonly id: BusId
  }

  readonly destination: {
    readonly type: 'Output'
  } | {
    readonly type: 'Bus'
    readonly id: BusId
  }
}

// Top-level type

export interface Program {
  readonly beatsPerBar: number

  readonly instruments: ReadonlyMap<InstrumentId, Instrument>
  readonly automations: ReadonlyMap<ParameterId, Automation>

  readonly track: Track
  readonly mixer: Mixer
}
