import type { Numeric } from '@core/program.js'

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

interface BeatDurationParts {
  readonly sign: number
  readonly bars: number
  readonly beats: number
}

function getBeatDurationParts (duration: Numeric<'beats'>, beatsPerBar: number): BeatDurationParts {
  const sign = Math.sign(duration.value)
  let remainingBeats = Math.abs(duration.value)

  const bars = Math.floor(remainingBeats / beatsPerBar)
  remainingBeats -= bars * beatsPerBar

  return {
    sign,
    bars,
    beats: remainingBeats
  }
}

export function formatBeatDuration (duration: Numeric<'beats'>, beatsPerBar: number): string {
  const { sign, bars, beats } = getBeatDurationParts(duration, beatsPerBar)
  return `${sign < 0 ? '-' : ''}${bars}:${beats.toFixed(2)}`
}

export function formatBeatDurationAsWords (duration: Numeric<'beats'>, beatsPerBar: number): string {
  const { sign, bars, beats } = getBeatDurationParts(duration, beatsPerBar)
  const parts: string[] = []

  if (bars > 0) {
    parts.push(pluralize(bars, 'bar'))
  }

  if (beats > 0) {
    parts.push(pluralize(beats, 'beat'))
  }

  if (parts.length === 0) {
    return '0 beats'
  }

  return `${sign < 0 ? '-' : ''}${parts.join(' ')}`
}
