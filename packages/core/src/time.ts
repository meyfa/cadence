import { type Numeric, numeric } from '@utility'
import type { Program } from './program.js'

export interface BeatRange {
  readonly start: Numeric<'beats'>
  readonly end?: Numeric<'beats'>
}

export function beatsToSeconds (
  beats: Numeric<'beats'>,
  tempo: Numeric<'bpm'>
): Numeric<'s'> {
  return numeric('s', (beats.value * 60) / tempo.value)
}

export function calculateTotalLength (program: Program): Numeric<'beats'> {
  return numeric(
    'beats',
    program.track.parts.reduce((total, part) => total + part.length.value, 0)
  )
}
