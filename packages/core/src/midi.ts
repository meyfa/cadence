import { Frequency, intervalToFrequencyRatio } from 'tone'
import type { Pitch } from './program.js'

const pitchToMidi = new Map<Pitch, number>()

for (let octave = 0; octave <= 10; ++octave) {
  for (const note of ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const) {
    for (const accidental of ['', '#', 'b'] as const) {
      const pitch = `${note}${accidental}${octave}` as Pitch
      pitchToMidi.set(pitch, Frequency(pitch).toMidi())
    }
  }
}

export function convertPitchToMidi (pitch: Pitch): number {
  const midi = pitchToMidi.get(pitch)
  if (midi === undefined) {
    throw new Error(`Invalid pitch: ${pitch}`)
  }

  return midi
}

export function convertPitchToPlaybackRate (note: Pitch, root: Pitch): number {
  const noteMidi = convertPitchToMidi(note)
  const rootMidi = convertPitchToMidi(root)
  return intervalToFrequencyRatio(noteMidi - rootMidi)
}
