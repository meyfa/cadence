import type { Curve } from '@meyfa/cadence-core'
import { gainToDb } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { Envelope } from '../../src/library/envelope.js'
import { applyEnvelope } from '../../src/library/envelope.js'

const scalar = (value: number) => value as Numeric<undefined>
const seconds = (value: number) => value as Numeric<'s'>
const db = (value: number) => value as Numeric<'db'>

const COMPLETE_SILENCE = db(-Infinity)
const RELATIVE_SILENCE = db(-60)

function interpolateDb (start: number, end: number, duration: number, elapsed: number): Numeric<'db'> {
  const t = elapsed / duration
  return db(start + t * (end - start))
}

function createEnvelope (values: { attack: number, decay: number, sustain: number, release: number }): Envelope {
  return {
    attack: seconds(values.attack),
    decay: seconds(values.decay),
    sustain: db(values.sustain),
    release: seconds(values.release)
  }
}

describe('envelope.ts', () => {
  describe('applyEnvelope()', () => {
    it('emits attack and decay without release when hold duration is absent', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 3 }), {
        gate: undefined,
        velocity: scalar(1)
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: seconds(0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: seconds(1), value: db(0), shape: 'linear' },
          { time: seconds(3), value: db(-6), shape: 'linear' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('handles zero-length attack by setting the peak immediately before decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 0, decay: 2, sustain: -6, release: 3 }), {
        gate: undefined,
        velocity: scalar(1)
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: seconds(0), value: db(0), shape: 'step' },
          { time: seconds(2), value: db(-6), shape: 'linear' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('handles zero-length decay by setting the sustain level immediately after attack', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 0, sustain: -6, release: 3 }), {
        gate: undefined,
        velocity: scalar(1)
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: seconds(0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: seconds(1), value: db(0), shape: 'linear' },
          { time: seconds(1), value: db(-6), shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('starts release from the current attack level when the note ends during attack', () => {
      const result = applyEnvelope(createEnvelope({ attack: 4, decay: 2, sustain: -6, release: 1 }), {
        gate: seconds(1),
        velocity: scalar(1)
      })

      const attackLevel = interpolateDb(RELATIVE_SILENCE, 0, 4, 1)
      const releaseEndValue = db(attackLevel + RELATIVE_SILENCE)

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: seconds(0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: seconds(1), value: attackLevel, shape: 'linear' },
          { time: seconds(2), value: releaseEndValue, shape: 'linear' },
          { time: seconds(2), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('starts release from the current decay level when the note ends during decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 1 }), {
        gate: seconds(2),
        velocity: scalar(1)
      })

      const decayLevel = interpolateDb(0, -6, 2, 1)
      const releaseEndValue = db(decayLevel + RELATIVE_SILENCE)

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: seconds(0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: seconds(1), value: db(0), shape: 'linear' },
          { time: seconds(2), value: decayLevel, shape: 'linear' },
          { time: seconds(3), value: releaseEndValue, shape: 'linear' },
          { time: seconds(3), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('starts release from sustain when the note ends after decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 4 }), {
        gate: seconds(5),
        velocity: scalar(0.75)
      })

      const velocityLevel = db(gainToDb(scalar(0.75)))

      const startLevel = db(velocityLevel + RELATIVE_SILENCE)
      const sustainLevel = db(velocityLevel - 6)
      const releaseEndValue = db(sustainLevel + RELATIVE_SILENCE)

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: seconds(0), value: startLevel, shape: 'step' },
          { time: seconds(1), value: velocityLevel, shape: 'linear' },
          { time: seconds(3), value: sustainLevel, shape: 'linear' },
          { time: seconds(5), value: sustainLevel, shape: 'step' },
          { time: seconds(9), value: releaseEndValue, shape: 'linear' },
          { time: seconds(9), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('handles zero-length release by setting the value to 0 immediately after hold duration', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 0 }), {
        gate: seconds(5),
        velocity: scalar(1)
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: seconds(0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: seconds(1), value: db(0), shape: 'linear' },
          { time: seconds(3), value: db(-6), shape: 'linear' },
          { time: seconds(5), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })
  })
})
