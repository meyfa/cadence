import { makeNumeric, type Numeric, type Program } from '@core/program.js'

export function stepsToSeconds (
  steps: Numeric<'steps'>,
  tempo: Numeric<'bpm'>,
  stepsPerBeat: number
): Numeric<'s'> {
  return makeNumeric('s', (steps.value * 60) / (stepsPerBeat * tempo.value))
}

export function calculateTotalDuration (program: Program): Numeric<'s'> {
  const steps = makeNumeric(
    'steps',
    program.track.sections.reduce((total, section) => total + section.length.value, 0)
  )

  return stepsToSeconds(steps, program.track.tempo, program.stepsPerBeat)
}
