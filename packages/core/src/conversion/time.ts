import type { Numeric, RuntimeNumeric } from '@utility'
import { runtimeNumeric } from '@utility'
import type { Program } from '../program/program.js'

export function beatsToSeconds (
  beats: Numeric<'beats'>,
  tempo: Numeric<'bpm'>
): Numeric<'s'> {
  return ((beats * 60) / tempo) as Numeric<'s'>
}

export function timeToSeconds (
  time: RuntimeNumeric<'beats'> | RuntimeNumeric<'s'>,
  tempo: Numeric<'bpm'>
): RuntimeNumeric<'s'> {
  return time.unit === 's' ? time : runtimeNumeric('s', beatsToSeconds(time.value, tempo))
}

export function calculateTotalLength (program: Program): Numeric<'beats'> {
  return program.track.parts.reduce((total, part) => total + part.length.value, 0) as Numeric<'beats'>
}
