export function pluralize (count: number, singular: string, plural = singular.at(-1) === 's' ? `${singular}es` : `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatDuration (seconds: number): string {
  const sign = seconds < 0 ? '-' : ''

  const totalSeconds = Math.round(Math.abs(seconds))

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60

  if (hours > 0) {
    return `${sign}${hours}h${String(minutes).padStart(2, '0')}m${String(secs).padStart(2, '0')}s`
  }

  if (minutes > 0) {
    return `${sign}${minutes}m${String(secs).padStart(2, '0')}s`
  }

  return `${sign}${secs}s`
}

export function formatStepDuration (steps: number, options: {
  readonly beatsPerBar: number
  readonly stepsPerBeat: number
}): string {
  const { beatsPerBar, stepsPerBeat } = options
  const stepsPerBar = beatsPerBar * stepsPerBeat

  const sign = steps < 0 ? '-' : ''
  let remainingSteps = Math.round(Math.abs(steps))

  const bars = Math.floor(remainingSteps / stepsPerBar)
  remainingSteps -= bars * stepsPerBar

  const beats = Math.floor(remainingSteps / stepsPerBeat)
  remainingSteps -= beats * stepsPerBeat

  return `${sign}${bars}:${beats}:${remainingSteps}`
}
