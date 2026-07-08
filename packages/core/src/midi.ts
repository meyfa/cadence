import type { Brand } from '@utility'
import type { Pitch } from './pattern/types.js'

// Note: Actual MIDI supports 0-127 (C-1 through G9), but for syntactical
// simplicity, we instead support the range resulting from:
//
// "any note letter" + "any accidental" + "any octave from 0 to 10".
//
// This results in the range Cb0 (=B-1, MIDI 11) through B#10 (=C11, MIDI 144),
// which has some overlap with MIDI, but is neither a subset nor a superset.

export type MidiNote = Brand<number, 'core.MidiNote'>

const pitchToMidi = new Map<Pitch, MidiNote>()

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
      pitchToMidi.set(pitch, midi as MidiNote)
    }
  }
}

export function convertPitchToMidi (pitch: Pitch): MidiNote {
  const midi = pitchToMidi.get(pitch)
  if (midi === undefined) {
    throw new Error(`Invalid pitch: ${pitch}`)
  }

  return midi
}

export function getMidiFrequency (midi: MidiNote): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
