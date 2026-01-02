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

export function formatBeatDuration (duration: Numeric<'beats'>, beatsPerBar: number): string {
  const sign = duration.value < 0 ? '-' : ''
  let remainingBeats = Math.abs(duration.value)

  const bars = Math.floor(remainingBeats / beatsPerBar)
  remainingBeats -= bars * beatsPerBar

  return `${sign}${bars}:${remainingBeats.toFixed(2)}`
}
