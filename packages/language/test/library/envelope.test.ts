import type { Curve } from '@core'
import { gainToDb } from '@core'
import type { Numeric } from '@utility'
import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { Envelope } from '../../src/library/envelope.js'
import { applyEnvelope } from '../../src/library/envelope.js'

const COMPLETE_SILENCE = numeric('db', -Infinity)
const RELATIVE_SILENCE = numeric('db', -60)

function interpolateDb (start: number, end: number, duration: number, elapsed: number): Numeric<'db'> {
  const t = elapsed / duration
  return numeric('db', start + t * (end - start))
}

function createEnvelope (values: { attack: number, decay: number, sustain: number, release: number }): Envelope {
  return {
    attack: numeric('s', values.attack),
    decay: numeric('s', values.decay),
    sustain: numeric('db', values.sustain),
    release: numeric('s', values.release)
  }
}

describe('envelope.ts', () => {
  describe('applyEnvelope()', () => {
    it('emits attack and decay without release when hold duration is absent', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 3 }), {
        gate: undefined,
        velocity: numeric(undefined, 1)
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: numeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: numeric('s', 1), value: numeric('db', 0), shape: 'linear' },
          { time: numeric('s', 3), value: numeric('db', -6), shape: 'linear' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('handles zero-length attack by setting the peak immediately before decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 0, decay: 2, sustain: -6, release: 3 }), {
        gate: undefined,
        velocity: numeric(undefined, 1)
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: numeric('s', 0), value: numeric('db', 0), shape: 'step' },
          { time: numeric('s', 2), value: numeric('db', -6), shape: 'linear' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('handles zero-length decay by setting the sustain level immediately after attack', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 0, sustain: -6, release: 3 }), {
        gate: undefined,
        velocity: numeric(undefined, 1)
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: numeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: numeric('s', 1), value: numeric('db', 0), shape: 'linear' },
          { time: numeric('s', 1), value: numeric('db', -6), shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('starts release from the current attack level when the note ends during attack', () => {
      const result = applyEnvelope(createEnvelope({ attack: 4, decay: 2, sustain: -6, release: 1 }), {
        gate: numeric('s', 1),
        velocity: numeric(undefined, 1)
      })

      const attackLevel = interpolateDb(RELATIVE_SILENCE.value, 0, 4, 1)
      const releaseEndValue = numeric('db', attackLevel.value + RELATIVE_SILENCE.value)

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: numeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: numeric('s', 1), value: attackLevel, shape: 'linear' },
          { time: numeric('s', 2), value: releaseEndValue, shape: 'linear' },
          { time: numeric('s', 2), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('starts release from the current decay level when the note ends during decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 1 }), {
        gate: numeric('s', 2),
        velocity: numeric(undefined, 1)
      })

      const decayLevel = interpolateDb(0, -6, 2, 1)
      const releaseEndValue = numeric('db', decayLevel.value + RELATIVE_SILENCE.value)

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: numeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: numeric('s', 1), value: numeric('db', 0), shape: 'linear' },
          { time: numeric('s', 2), value: decayLevel, shape: 'linear' },
          { time: numeric('s', 3), value: releaseEndValue, shape: 'linear' },
          { time: numeric('s', 3), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('starts release from sustain when the note ends after decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 4 }), {
        gate: numeric('s', 5),
        velocity: numeric(undefined, 0.75)
      })

      const startLevel = numeric('db', gainToDb(0.75) + RELATIVE_SILENCE.value)
      const velocityLevel = numeric('db', gainToDb(0.75))
      const sustainLevel = numeric('db', gainToDb(0.75) - 6)
      const releaseEndValue = numeric('db', sustainLevel.value + RELATIVE_SILENCE.value)

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: numeric('s', 0), value: startLevel, shape: 'step' },
          { time: numeric('s', 1), value: velocityLevel, shape: 'linear' },
          { time: numeric('s', 3), value: sustainLevel, shape: 'linear' },
          { time: numeric('s', 5), value: sustainLevel, shape: 'step' },
          { time: numeric('s', 9), value: releaseEndValue, shape: 'linear' },
          { time: numeric('s', 9), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('handles zero-length release by setting the value to 0 immediately after hold duration', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 0 }), {
        gate: numeric('s', 5),
        velocity: numeric(undefined, 1)
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: numeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: numeric('s', 1), value: numeric('db', 0), shape: 'linear' },
          { time: numeric('s', 3), value: numeric('db', -6), shape: 'linear' },
          { time: numeric('s', 5), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })
  })
})
