import type { Numeric, RuntimeNumeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { Program } from '../../src/program/program.ts'
import { beatsToSeconds, calculateTotalLength, timeToSeconds } from '../../src/conversion/time.ts'

describe('conversion/time.ts', () => {
  describe('beatsToSeconds()', () => {
    it('converts beats to seconds using the given tempo', () => {
      assert.strictEqual(beatsToSeconds(120 as Numeric<'beats'>, 120 as Numeric<'bpm'>), 60)
      assert.strictEqual(beatsToSeconds(4 as Numeric<'beats'>, 60 as Numeric<'bpm'>), 4)
      assert.strictEqual(beatsToSeconds(2 as Numeric<'beats'>, 120 as Numeric<'bpm'>), 1)
    })
  })

  describe('timeToSeconds()', () => {
    it('returns the value directly when already in seconds', () => {
      const time = { unit: 's', value: 2.5 } as RuntimeNumeric<'s'>
      assert.strictEqual(timeToSeconds(time, 120 as Numeric<'bpm'>), 2.5)
    })

    it('converts to seconds when given in beats', () => {
      const time = { unit: 'beats', value: 4 } as RuntimeNumeric<'beats'>
      assert.strictEqual(timeToSeconds(time, 60 as Numeric<'bpm'>), 4)
    })
  })

  describe('calculateTotalLength()', () => {
    it('sums the lengths of all parts in the track', () => {
      const program = {
        track: {
          parts: [
            { length: 4 as Numeric<'beats'>, routings: [], automations: [] },
            { length: 8 as Numeric<'beats'>, routings: [], automations: [] }
          ]
        }
      } as unknown as Program

      assert.strictEqual(calculateTotalLength(program), 12)
    })

    it('returns 0 for a track with no parts', () => {
      const program = {
        track: {
          parts: []
        }
      } as unknown as Program

      assert.strictEqual(calculateTotalLength(program), 0)
    })
  })
})
