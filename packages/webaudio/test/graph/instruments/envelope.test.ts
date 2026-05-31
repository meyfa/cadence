import type { Envelope } from '@core'
import { numeric } from '@utility'
import { describe, it } from 'node:test'
import assert from 'node:assert'
import type { EnvelopeTarget } from '../../../src/graph/instruments/envelope.js'
import { applyEnvelope } from '../../../src/graph/instruments/envelope.js'

type EnvelopeEvent =
  { type: 'cancel', time: number } |
  { type: 'set' | 'ramp', value: number, time: number }

class MockEnvelopeTarget implements EnvelopeTarget {
  readonly events: EnvelopeEvent[] = []

  cancelScheduledValues (time: number): void {
    this.events.push({ type: 'cancel', time })
  }

  setValueAtTime (value: number, time: number): void {
    this.events.push({ type: 'set', value, time })
  }

  linearRampToValueAtTime (value: number, time: number): void {
    this.events.push({ type: 'ramp', value, time })
  }
}

function createEnvelope (values: { attack: number, decay: number, sustain: number, release: number }): Envelope {
  return {
    attack: numeric('s', values.attack),
    decay: numeric('s', values.decay),
    sustain: numeric(undefined, values.sustain),
    release: numeric('s', values.release)
  }
}

describe('graph/instruments/envelope.ts', () => {
  describe('applyEnvelope()', () => {
    it('schedules attack and decay without release when hold duration is absent', () => {
      const target = new MockEnvelopeTarget()

      applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: 0.5, release: 3 }), target, {
        time: 10,
        velocity: 1
      })

      assert.deepStrictEqual(target.events, [
        { type: 'set', value: 0, time: 10 },
        { type: 'ramp', value: 1, time: 11 },
        { type: 'ramp', value: 0.5, time: 13 }
      ])
    })

    it('handles zero-length attack by setting the peak immediately before decay', () => {
      const target = new MockEnvelopeTarget()

      applyEnvelope(createEnvelope({ attack: 0, decay: 2, sustain: 0.5, release: 3 }), target, {
        time: 10,
        velocity: 1
      })

      assert.deepStrictEqual(target.events, [
        { type: 'set', value: 1, time: 10 },
        { type: 'ramp', value: 0.5, time: 12 }
      ])
    })

    it('handles zero-length decay by setting the sustain level immediately after attack', () => {
      const target = new MockEnvelopeTarget()

      applyEnvelope(createEnvelope({ attack: 1, decay: 0, sustain: 0.5, release: 3 }), target, {
        time: 10,
        velocity: 1
      })

      assert.deepStrictEqual(target.events, [
        { type: 'set', value: 0, time: 10 },
        { type: 'ramp', value: 1, time: 11 },
        { type: 'set', value: 0.5, time: 11 }
      ])
    })

    it('starts release from the current attack level when the note ends during attack', () => {
      const target = new MockEnvelopeTarget()

      applyEnvelope(createEnvelope({ attack: 4, decay: 2, sustain: 0.5, release: 1 }), target, {
        time: 3,
        velocity: 1,
        holdDuration: 1
      })

      assert.deepStrictEqual(target.events.slice(-3), [
        { type: 'cancel', time: 4 },
        { type: 'set', value: 0.25, time: 4 },
        { type: 'ramp', value: 0, time: 5 }
      ])
    })

    it('starts release from the current decay level when the note ends during decay', () => {
      const target = new MockEnvelopeTarget()

      applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: 0.5, release: 1 }), target, {
        time: 10,
        velocity: 1,
        holdDuration: 2
      })

      assert.deepStrictEqual(target.events.slice(-3), [
        { type: 'cancel', time: 12 },
        { type: 'set', value: 0.75, time: 12 },
        { type: 'ramp', value: 0, time: 13 }
      ])
    })

    it('starts release from sustain when the note ends after decay', () => {
      const target = new MockEnvelopeTarget()

      applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: 0.5, release: 4 }), target, {
        time: 10,
        velocity: 0.8,
        holdDuration: 5
      })

      assert.deepStrictEqual(target.events.slice(-3), [
        { type: 'cancel', time: 15 },
        { type: 'set', value: 0.4, time: 15 },
        { type: 'ramp', value: 0, time: 19 }
      ])
    })

    it('handles zero-length release by setting the value to 0 immediately after hold duration', () => {
      const target = new MockEnvelopeTarget()

      applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: 0.5, release: 0 }), target, {
        time: 10,
        velocity: 1,
        holdDuration: 5
      })

      assert.deepStrictEqual(target.events.slice(-2), [
        { type: 'cancel', time: 15 },
        { type: 'set', value: 0, time: 15 }
      ])
    })
  })
})
