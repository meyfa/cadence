import { describe, it } from 'node:test'
import assert from 'node:assert'
import { convertPitchToMidi } from '../src/midi.js'

describe('midi.ts', () => {
  it('maps pitches to standard MIDI note numbers', () => {
    assert.strictEqual(convertPitchToMidi('C4'), 60)
    assert.strictEqual(convertPitchToMidi('A4'), 69)
    assert.strictEqual(convertPitchToMidi('C5'), 72)
    assert.strictEqual(convertPitchToMidi('B0'), 23)
  })
})
