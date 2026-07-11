import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { MidiNote } from '../../src/conversion/midi.js'
import { convertPitchToMidi, getMidiFrequency } from '../../src/conversion/midi.js'

describe('midi.ts', () => {
  describe('convertPitchToMidi()', () => {
    it('maps pitches to standard MIDI note numbers', () => {
      assert.strictEqual(convertPitchToMidi('C0'), 12)
      assert.strictEqual(convertPitchToMidi('C#0'), 13)
      assert.strictEqual(convertPitchToMidi('Db0'), 13)
      assert.strictEqual(convertPitchToMidi('C4'), 60)
      assert.strictEqual(convertPitchToMidi('A4'), 69)
      assert.strictEqual(convertPitchToMidi('C5'), 72)
    })

    it('supports octaves from 0 to 10', () => {
      assert.strictEqual(convertPitchToMidi('Cb0'), 11)
      assert.strictEqual(convertPitchToMidi('C0'), 12)

      assert.strictEqual(convertPitchToMidi('G9'), 127)
      assert.strictEqual(convertPitchToMidi('G#9'), 128)
      assert.strictEqual(convertPitchToMidi('Ab9'), 128)

      assert.strictEqual(convertPitchToMidi('B10'), 143)
      assert.strictEqual(convertPitchToMidi('B#10'), 144)
    })
  })

  describe('getMidiFrequency()', () => {
    it('calculates the frequency of MIDI notes', () => {
      assert.ok(Math.abs(getMidiFrequency(69 as MidiNote) - 440) < 1e-6)
      assert.ok(Math.abs(getMidiFrequency(60 as MidiNote) - 261.625565) < 1e-6)
      assert.ok(Math.abs(getMidiFrequency(72 as MidiNote) - 523.251130) < 1e-6)
    })
  })
})
