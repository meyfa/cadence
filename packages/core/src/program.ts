import type { Brand, Numeric, Unit } from '@utility'

export type Note = `${'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'}${'' | '#' | 'b'}`
export type Octave = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type Pitch = `${Note}${Octave}`
export type StepValue = '-' | 'x' | Pitch

// Patterns

export interface Step {
  readonly value: StepValue

  /**
    * The duration of the step. Defaults to 1.
   */
  readonly length?: Numeric<undefined>

  /**
    * The gate (duration) of the step. If undefined, the gate is equal to the step's length.
   */
  readonly gate?: Numeric<undefined>

  /**
   * The velocity of the step, in the range [0, 1]. Defaults to 1.
   */
  readonly velocity?: Numeric<undefined>
}

export interface NoteData {
  /**
   * The gate (duration) of the note in beats. If undefined, the note is never released (held indefinitely),
   * and may or may not be cut off by subsequent notes depending on the instrument's behavior.
   */
  readonly gate?: Numeric<'beats'>

  /**
   * The pitch associated with the note. If undefined, indicates that the instrument's default pitch should be used.
   */
  readonly pitch?: Pitch

  /**
   * The velocity of the note, in the range [0, 1].
   */
  readonly velocity: Numeric<undefined>
}

export interface NoteEvent extends NoteData {
  /**
   * The time at which the note event occurs.
   */
  readonly time: Numeric<'beats'>
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
  readonly time: Numeric<'s'>
  readonly value: Numeric<U>

  /**
   * The curve from the previous point, or from the initial value, to this point.
   */
  readonly curve: 'linear' | 'step'
}

export type AssetId = Brand<number, 'core.AssetId'>

export interface Asset {
  readonly id: AssetId
  readonly url: string
}

export type InstrumentId = Brand<number, 'core.InstrumentId'>

export interface Instrument {
  readonly id: InstrumentId
  readonly rootNote?: Pitch
  readonly gain: Parameter<'db'>
  readonly trigger: (note: NoteData) => readonly Voice[]
}

export interface Voice {
  readonly source: Source
  readonly envelope: Envelope
}

export type Source = Sample | Oscillator

export interface Sample {
  readonly type: 'sample'
  readonly assetId: AssetId
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
  ReverbEffect |
  ClipEffect

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
  readonly feedback: Parameter<undefined>
  readonly wet: Numeric<'db'>
}

export interface ReverbEffect {
  readonly type: 'reverb'
  readonly mix: Numeric<undefined>
  readonly decay: Numeric<'beats'> | Numeric<'s'>
  readonly wet: Numeric<'db'>
}

export interface ClipEffect {
  readonly type: 'clip'
  readonly threshold: Parameter<'db'>
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
  readonly assets: ReadonlyMap<AssetId, Asset>

  readonly track: Track
  readonly mixer: Mixer
}
