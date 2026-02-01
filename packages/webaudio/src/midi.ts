import type { Pitch } from '@core/program.js'

const pitchToMidi = new Map<Pitch, number>()

for (let octave = 0; octave <= 10; ++octave) {
  for (const note of ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const) {
    for (const accidental of ['', '#', 'b'] as const) {
      const pitch = `${note}${accidental}${octave}` as Pitch

      const semitoneOffset = (() => {
        switch (note) {
          case 'C': return 0
          case 'D': return 2
          case 'E': return 4
          case 'F': return 5
          case 'G': return 7
          case 'A': return 9
          case 'B': return 11
        }
      })()

      const accidentalOffset = (() => {
        switch (accidental) {
          case '': return 0
          case '#': return 1
          case 'b': return -1
        }
      })()

      // Standard MIDI note numbers use C-1 = 0, hence the +1 octave offset.
      const midi = (octave + 1) * 12 + semitoneOffset + accidentalOffset
      if (midi >= 0 && midi <= 127) {
        pitchToMidi.set(pitch, midi)
      }
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
