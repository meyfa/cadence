import { makeNumeric, type Numeric, type Program } from '@core/program.js'

export function beatsToSeconds (
  beats: Numeric<'beats'>,
  tempo: Numeric<'bpm'>
): Numeric<'s'> {
  return makeNumeric('s', (beats.value * 60) / tempo.value)
}

export function calculateTotalDuration (program: Program): Numeric<'s'> {
  const beats = makeNumeric(
    'beats',
    program.track.sections.reduce((total, section) => total + section.length.value, 0)
  )

  return beatsToSeconds(beats, program.track.tempo)
}
