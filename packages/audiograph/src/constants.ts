import { convertPitchToMidi } from '@core'

export const DEFAULT_ROOT_NOTE = convertPitchToMidi('C5')

export function dbToGain (db: number): number {
  if (Number.isNaN(db) || (db > 0 && !Number.isFinite(db))) {
    throw new Error(`Invalid gain: ${db}`)
  }

  return Math.pow(10, db / 20)
}
