import type { Envelope } from '@core'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { applyEnvelope } from '../src/envelope.js'

function createEnvelope (values: { attack: number, decay: number, sustain: number, release: number }): Envelope {
  return {
    attack: numeric('s', values.attack),
    decay: numeric('s', values.decay),
    sustain: numeric(undefined, values.sustain),
    release: numeric('s', values.release)
  }
}

describe('envelope.ts', () => {
  describe('applyEnvelope()', () => {
    it('emits attack and decay without release when hold duration is absent', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: 0.5, release: 3 }), {
        velocity: numeric(undefined, 1)
      })

      assert.deepStrictEqual(result, {
        initial: numeric(undefined, 0),
        points: [
          { time: numeric('s', 0), value: numeric(undefined, 0), curve: 'step' },
          { time: numeric('s', 1), value: numeric(undefined, 1), curve: 'linear' },
          { time: numeric('s', 3), value: numeric(undefined, 0.5), curve: 'linear' }
        ]
      })
    })

    it('handles zero-length attack by setting the peak immediately before decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 0, decay: 2, sustain: 0.5, release: 3 }), {
        velocity: numeric(undefined, 1)
      })

      assert.deepStrictEqual(result, {
        initial: numeric(undefined, 0),
        points: [
          { time: numeric('s', 0), value: numeric(undefined, 1), curve: 'step' },
          { time: numeric('s', 2), value: numeric(undefined, 0.5), curve: 'linear' }
        ]
      })
    })

    it('handles zero-length decay by setting the sustain level immediately after attack', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 0, sustain: 0.5, release: 3 }), {
        velocity: numeric(undefined, 1)
      })

      assert.deepStrictEqual(result, {
        initial: numeric(undefined, 0),
        points: [
          { time: numeric('s', 0), value: numeric(undefined, 0), curve: 'step' },
          { time: numeric('s', 1), value: numeric(undefined, 1), curve: 'linear' },
          { time: numeric('s', 1), value: numeric(undefined, 0.5), curve: 'step' }
        ]
      })
    })

    it('starts release from the current attack level when the note ends during attack', () => {
      const result = applyEnvelope(createEnvelope({ attack: 4, decay: 2, sustain: 0.5, release: 1 }), {
        velocity: numeric(undefined, 1),
        gate: numeric('s', 1)
      })

      assert.deepStrictEqual(result, {
        initial: numeric(undefined, 0),
        points: [
          { time: numeric('s', 0), value: numeric(undefined, 0), curve: 'step' },
          { time: numeric('s', 1), value: numeric(undefined, 0.25), curve: 'linear' },
          { time: numeric('s', 2), value: numeric(undefined, 0), curve: 'linear' }
        ]
      })
    })

    it('starts release from the current decay level when the note ends during decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: 0.5, release: 1 }), {
        velocity: numeric(undefined, 1),
        gate: numeric('s', 2)
      })

      assert.deepStrictEqual(result, {
        initial: numeric(undefined, 0),
        points: [
          { time: numeric('s', 0), value: numeric(undefined, 0), curve: 'step' },
          { time: numeric('s', 1), value: numeric(undefined, 1), curve: 'linear' },
          { time: numeric('s', 2), value: numeric(undefined, 0.75), curve: 'linear' },
          { time: numeric('s', 3), value: numeric(undefined, 0), curve: 'linear' }
        ]
      })
    })

    it('starts release from sustain when the note ends after decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: 0.5, release: 4 }), {
        velocity: numeric(undefined, 0.8),
        gate: numeric('s', 5)
      })

      assert.deepStrictEqual(result, {
        initial: numeric(undefined, 0),
        points: [
          { time: numeric('s', 0), value: numeric(undefined, 0), curve: 'step' },
          { time: numeric('s', 1), value: numeric(undefined, 0.8), curve: 'linear' },
          { time: numeric('s', 3), value: numeric(undefined, 0.4), curve: 'linear' },
          { time: numeric('s', 5), value: numeric(undefined, 0.4), curve: 'step' },
          { time: numeric('s', 9), value: numeric(undefined, 0), curve: 'linear' }
        ]
      })
    })

    it('handles zero-length release by setting the value to 0 immediately after hold duration', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: 0.5, release: 0 }), {
        velocity: numeric(undefined, 1),
        gate: numeric('s', 5)
      })

      assert.deepStrictEqual(result, {
        initial: numeric(undefined, 0),
        points: [
          { time: numeric('s', 0), value: numeric(undefined, 0), curve: 'step' },
          { time: numeric('s', 1), value: numeric(undefined, 1), curve: 'linear' },
          { time: numeric('s', 3), value: numeric(undefined, 0.5), curve: 'linear' },
          { time: numeric('s', 5), value: numeric(undefined, 0), curve: 'step' }
        ]
      })
    })
  })
})
