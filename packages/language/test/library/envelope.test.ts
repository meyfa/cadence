import type { Curve } from '@core'
import { gainToDb } from '@core'
import type { Numeric, RuntimeNumeric } from '@utility'
import { runtimeNumeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { Envelope } from '../../src/library/envelope.js'
import { applyEnvelope } from '../../src/library/envelope.js'

const COMPLETE_SILENCE = runtimeNumeric('db', -Infinity)
const RELATIVE_SILENCE = runtimeNumeric('db', -60)

function interpolateDb (start: number, end: number, duration: number, elapsed: number): RuntimeNumeric<'db'> {
  const t = elapsed / duration
  return runtimeNumeric('db', start + t * (end - start))
}

function createEnvelope (values: { attack: number, decay: number, sustain: number, release: number }): Envelope {
  return {
    attack: runtimeNumeric('s', values.attack),
    decay: runtimeNumeric('s', values.decay),
    sustain: runtimeNumeric('db', values.sustain),
    release: runtimeNumeric('s', values.release)
  }
}

describe('envelope.ts', () => {
  describe('applyEnvelope()', () => {
    it('emits attack and decay without release when hold duration is absent', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 3 }), {
        gate: undefined,
        velocity: 1 as Numeric<undefined>
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: runtimeNumeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: runtimeNumeric('s', 1), value: runtimeNumeric('db', 0), shape: 'linear' },
          { time: runtimeNumeric('s', 3), value: runtimeNumeric('db', -6), shape: 'linear' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('handles zero-length attack by setting the peak immediately before decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 0, decay: 2, sustain: -6, release: 3 }), {
        gate: undefined,
        velocity: 1 as Numeric<undefined>
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: runtimeNumeric('s', 0), value: runtimeNumeric('db', 0), shape: 'step' },
          { time: runtimeNumeric('s', 2), value: runtimeNumeric('db', -6), shape: 'linear' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('handles zero-length decay by setting the sustain level immediately after attack', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 0, sustain: -6, release: 3 }), {
        gate: undefined,
        velocity: 1 as Numeric<undefined>
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: runtimeNumeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: runtimeNumeric('s', 1), value: runtimeNumeric('db', 0), shape: 'linear' },
          { time: runtimeNumeric('s', 1), value: runtimeNumeric('db', -6), shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('starts release from the current attack level when the note ends during attack', () => {
      const result = applyEnvelope(createEnvelope({ attack: 4, decay: 2, sustain: -6, release: 1 }), {
        gate: 1 as Numeric<'s'>,
        velocity: 1 as Numeric<undefined>
      })

      const attackLevel = interpolateDb(RELATIVE_SILENCE.value, 0, 4, 1)
      const releaseEndValue = runtimeNumeric('db', attackLevel.value + RELATIVE_SILENCE.value)

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: runtimeNumeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: runtimeNumeric('s', 1), value: attackLevel, shape: 'linear' },
          { time: runtimeNumeric('s', 2), value: releaseEndValue, shape: 'linear' },
          { time: runtimeNumeric('s', 2), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('starts release from the current decay level when the note ends during decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 1 }), {
        gate: 2 as Numeric<'s'>,
        velocity: 1 as Numeric<undefined>
      })

      const decayLevel = interpolateDb(0, -6, 2, 1)
      const releaseEndValue = runtimeNumeric('db', decayLevel.value + RELATIVE_SILENCE.value)

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: runtimeNumeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: runtimeNumeric('s', 1), value: runtimeNumeric('db', 0), shape: 'linear' },
          { time: runtimeNumeric('s', 2), value: decayLevel, shape: 'linear' },
          { time: runtimeNumeric('s', 3), value: releaseEndValue, shape: 'linear' },
          { time: runtimeNumeric('s', 3), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('starts release from sustain when the note ends after decay', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 4 }), {
        gate: 5 as Numeric<'s'>,
        velocity: 0.75 as Numeric<undefined>
      })

      const velocityLevel = runtimeNumeric('db', gainToDb(0.75 as Numeric<undefined>))

      const startLevel = runtimeNumeric('db', velocityLevel.value + RELATIVE_SILENCE.value)
      const sustainLevel = runtimeNumeric('db', velocityLevel.value - 6)
      const releaseEndValue = runtimeNumeric('db', sustainLevel.value + RELATIVE_SILENCE.value)

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: runtimeNumeric('s', 0), value: startLevel, shape: 'step' },
          { time: runtimeNumeric('s', 1), value: velocityLevel, shape: 'linear' },
          { time: runtimeNumeric('s', 3), value: sustainLevel, shape: 'linear' },
          { time: runtimeNumeric('s', 5), value: sustainLevel, shape: 'step' },
          { time: runtimeNumeric('s', 9), value: releaseEndValue, shape: 'linear' },
          { time: runtimeNumeric('s', 9), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })

    it('handles zero-length release by setting the value to 0 immediately after hold duration', () => {
      const result = applyEnvelope(createEnvelope({ attack: 1, decay: 2, sustain: -6, release: 0 }), {
        gate: 5 as Numeric<'s'>,
        velocity: 1 as Numeric<undefined>
      })

      assert.deepStrictEqual(result, {
        initial: COMPLETE_SILENCE,
        points: [
          { time: runtimeNumeric('s', 0), value: RELATIVE_SILENCE, shape: 'step' },
          { time: runtimeNumeric('s', 1), value: runtimeNumeric('db', 0), shape: 'linear' },
          { time: runtimeNumeric('s', 3), value: runtimeNumeric('db', -6), shape: 'linear' },
          { time: runtimeNumeric('s', 5), value: COMPLETE_SILENCE, shape: 'step' }
        ]
      } satisfies Curve<'s', 'db'>)
    })
  })
})
