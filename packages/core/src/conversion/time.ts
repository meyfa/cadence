import type { RuntimeNumeric } from '@utility'
import { runtimeNumeric } from '@utility'
import type { Program } from '../program/program.js'

export function beatsToSeconds (
  beats: RuntimeNumeric<'beats'>,
  tempo: RuntimeNumeric<'bpm'>
): RuntimeNumeric<'s'> {
  return runtimeNumeric('s', (beats.value * 60) / tempo.value)
}

export function timeToSeconds (
  time: RuntimeNumeric<'beats'> | RuntimeNumeric<'s'>,
  tempo: RuntimeNumeric<'bpm'>
): RuntimeNumeric<'s'> {
  return time.unit === 's' ? time : beatsToSeconds(time, tempo)
}

export function calculateTotalLength (program: Program): RuntimeNumeric<'beats'> {
  return runtimeNumeric(
    'beats',
    program.track.parts.reduce((total, part) => total + part.length.value, 0)
  )
}
