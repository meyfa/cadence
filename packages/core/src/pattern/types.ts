import type { Numeric } from '@meyfa/cadence-utility'

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
  readonly length?: Numeric<'beats'>

  /**
    * The gate (duration) of the step. If undefined, the gate is equal to the step's length.
   */
  readonly gate?: Numeric<'beats'>

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
