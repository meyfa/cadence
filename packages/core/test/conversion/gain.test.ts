import assert from 'node:assert'
import { describe, it } from 'node:test'
import { dbToGain, gainToDb } from '../../src/conversion/gain.js'
import { numeric } from '@utility'

describe('conversion/gain.ts', () => {
  describe('dbToGain', () => {
    it('should convert decibels to gain correctly', () => {
      assert.deepStrictEqual(
        dbToGain(numeric('db', 0)),
        numeric(undefined, 1)
      )

      assert.deepStrictEqual(
        dbToGain(numeric('db', -Infinity)),
        numeric(undefined, 0)
      )

      const gain6 = dbToGain(numeric('db', 6))
      assert.ok(Math.abs(gain6.value - 1.9952623149688795) < 1e-10)

      const gainNeg6 = dbToGain(numeric('db', -6))
      assert.ok(Math.abs(gainNeg6.value - 0.5011872336272722) < 1e-10)

      const gain20 = dbToGain(numeric('db', 20))
      assert.ok(Math.abs(gain20.value - 10) < 1e-10)

      const gainNeg20 = dbToGain(numeric('db', -20))
      assert.ok(Math.abs(gainNeg20.value - 0.1) < 1e-10)
    })

    it('should throw for invalid input', () => {
      assert.throws(() => dbToGain(numeric('db', Number.NaN)), /Invalid gain/)
      assert.throws(() => dbToGain(numeric('db', Infinity)), /Invalid gain/)
    })
  })

  describe('gainToDb', () => {
    it('should convert gain to decibels correctly', () => {
      assert.deepStrictEqual(
        gainToDb(numeric(undefined, 1)),
        numeric('db', 0)
      )

      assert.deepStrictEqual(
        gainToDb(numeric(undefined, 0)),
        numeric('db', -Infinity)
      )

      const db6 = gainToDb(numeric(undefined, 1.9952623149688795))
      assert.ok(Math.abs(db6.value - 6) < 1e-10)

      const dbNeg6 = gainToDb(numeric(undefined, 0.5011872336272722))
      assert.ok(Math.abs(dbNeg6.value + 6) < 1e-10)

      const db20 = gainToDb(numeric(undefined, 10))
      assert.ok(Math.abs(db20.value - 20) < 1e-10)

      const dbNeg20 = gainToDb(numeric(undefined, 0.1))
      assert.ok(Math.abs(dbNeg20.value + 20) < 1e-10)
    })
  })
})
