import { convertPitchToMidi } from '@core/midi.js'

export const DEFAULT_ROOT_NOTE = convertPitchToMidi('C5')

export function dbToGain (db: number): number {
  return Math.pow(10, db / 20)
}
