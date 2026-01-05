import { makeNumeric, type Numeric, type Program } from '@core/program.js'

export function beatsToSeconds (
  beats: Numeric<'beats'>,
  tempo: Numeric<'bpm'>
): Numeric<'s'> {
  return makeNumeric('s', (beats.value * 60) / tempo.value)
}

export function calculateTotalLength (program: Program): Numeric<'beats'> {
  return makeNumeric(
    'beats',
    program.track.sections.reduce((total, section) => total + section.length.value, 0)
  )
}
