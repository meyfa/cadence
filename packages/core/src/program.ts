import type { Brand, Numeric, Unit } from '@utility'

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

export function isPitch (value: string): value is Pitch {
  return typeof value === 'string' && /^[A-G][#b]?(?:10|[0-9])$/.test(value)
}

export function isStepValue (value: string): value is StepValue {
  return value === '-' || value === 'x' || isPitch(value)
}

// Domain types

export type ParameterId = Brand<number, 'core.ParameterId'>

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

export type InstrumentId = Brand<number, 'core.InstrumentId'>

export interface Instrument {
  readonly id: InstrumentId
  readonly rootNote?: Pitch
  readonly gain: Parameter<'db'>
  readonly source: Source
  readonly envelope: Envelope
}

export type Source = Sample | Oscillator

export interface Sample {
  readonly type: 'sample'
  readonly url: string
  readonly length?: Numeric<'s'>
}

export interface Oscillator {
  readonly type: 'oscillator'
  readonly shape: 'sine' | 'square' | 'saw' | 'triangle'
}

export interface Envelope {
  readonly attack: Numeric<'s'>
  readonly decay: Numeric<'s'>
  readonly sustain: Numeric<undefined>
  readonly release: Numeric<'s'>
}

export interface Track {
  readonly tempo: Numeric<'bpm'>
  readonly parts: readonly Part[]
}

export interface Part {
  readonly name?: string
  readonly length: Numeric<'beats'>
  readonly routings: readonly InstrumentRouting[]
}

export interface InstrumentRouting {
  readonly source: {
    readonly type: 'pattern'
    readonly value: Pattern
  }

  readonly destination: {
    readonly type: 'instrument'
    readonly id: InstrumentId
  }
}

export interface Mixer {
  readonly buses: readonly Bus[]
  readonly routings: readonly MixerRouting[]
}

export type BusId = Brand<number, 'core.BusId'>

export interface Bus {
  readonly id: BusId
  readonly name: string
  readonly pan: Parameter<undefined>
  readonly gain: Parameter<'db'>
  readonly effects: readonly Effect[]
}

export type Effect =
  GainEffect |
  PanEffect |
  LowpassEffect |
  HighpassEffect |
  WidthEffect |
  DelayEffect |
  ReverbEffect

export interface GainEffect {
  readonly type: 'gain'
  readonly gain: Parameter<'db'>
}

export interface PanEffect {
  readonly type: 'pan'
  readonly pan: Parameter<undefined>
}

export interface LowpassEffect {
  readonly type: 'lowpass'
  readonly frequency: Parameter<'hz'>
}

export interface HighpassEffect {
  readonly type: 'highpass'
  readonly frequency: Parameter<'hz'>
}

export interface WidthEffect {
  readonly type: 'width'
  readonly width: Numeric<undefined>
}

export interface DelayEffect {
  readonly type: 'delay'
  readonly mix: Numeric<undefined>
  readonly time: Numeric<'beats'> | Numeric<'s'>
  readonly feedback: Numeric<undefined>
  readonly wet: Numeric<'db'>
}

export interface ReverbEffect {
  readonly type: 'reverb'
  readonly mix: Numeric<undefined>
  readonly decay: Numeric<'beats'> | Numeric<'s'>
  readonly wet: Numeric<'db'>
}

export interface MixerRouting {
  readonly implicit: boolean

  readonly source: {
    readonly type: 'instrument'
    readonly id: InstrumentId
  } | {
    readonly type: 'bus'
    readonly id: BusId
  }

  readonly destination: {
    readonly type: 'output'
  } | {
    readonly type: 'bus'
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
