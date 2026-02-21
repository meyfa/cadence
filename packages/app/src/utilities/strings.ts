import type { Numeric } from '@core/program.js'

export function pluralize (count: number, singular: string, plural = singular.at(-1) === 's' ? `${singular}es` : `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatDuration (duration: Numeric<'s'>): string {
  const sign = duration.value < 0 ? '-' : ''

  const millis = Math.round(Math.abs(duration.value) * 1000)

  const hours = Math.floor(millis / (60 * 60 * 1000))
  const minutes = Math.floor((millis % (60 * 60 * 1000)) / (60 * 1000))
  const seconds = Math.floor((millis % (60 * 1000)) / 1000)
  const milliseconds = String(millis % 1000).padStart(3, '0')

  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }

  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`)
  }

  parts.push(`${seconds}.${milliseconds}s`)

  return sign + parts.join(' ')
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

export function formatBytes (bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['kiB', 'MiB', 'GiB', 'TiB']
  let unitIndex = -1
  let value = bytes

  do {
    value /= 1024
    ++unitIndex
  } while (value >= 1024 && unitIndex < units.length - 1)

  return `${value.toFixed(2)} ${units[unitIndex]}`
}
