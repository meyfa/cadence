import type { Numeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { dbToGain, gainToDb } from '../../src/conversion/gain.ts'

describe('conversion/gain.ts', () => {
  describe('dbToGain', () => {
    it('should convert decibels to gain correctly', () => {
      assert.strictEqual(dbToGain(0 as Numeric<'db'>), 1)
      assert.strictEqual(dbToGain(-Infinity as Numeric<'db'>), 0)

      const gain6 = dbToGain(6 as Numeric<'db'>)
      assert.ok(Math.abs(gain6 - 1.9952623149688795) < 1e-10)

      const gainNeg6 = dbToGain(-6 as Numeric<'db'>)
      assert.ok(Math.abs(gainNeg6 - 0.5011872336272722) < 1e-10)

      const gain20 = dbToGain(20 as Numeric<'db'>)
      assert.ok(Math.abs(gain20 - 10) < 1e-10)

      const gainNeg20 = dbToGain(-20 as Numeric<'db'>)
      assert.ok(Math.abs(gainNeg20 - 0.1) < 1e-10)
    })

    it('should throw for invalid input', () => {
      assert.throws(() => dbToGain(Number.NaN as Numeric<'db'>), /Invalid gain/)
      assert.throws(() => dbToGain(Infinity as Numeric<'db'>), /Invalid gain/)
    })
  })

  describe('gainToDb', () => {
    it('should convert gain to decibels correctly', () => {
      assert.strictEqual(gainToDb(1 as Numeric<undefined>), 0)
      assert.strictEqual(gainToDb(0 as Numeric<undefined>), -Infinity)

      const db6 = gainToDb(1.9952623149688795 as Numeric<undefined>)
      assert.ok(Math.abs(db6 - 6) < 1e-10)

      const dbNeg6 = gainToDb(0.5011872336272722 as Numeric<undefined>)
      assert.ok(Math.abs(dbNeg6 + 6) < 1e-10)

      const db20 = gainToDb(10 as Numeric<undefined>)
      assert.ok(Math.abs(db20 - 20) < 1e-10)

      const dbNeg20 = gainToDb(0.1 as Numeric<undefined>)
      assert.ok(Math.abs(dbNeg20 + 20) < 1e-10)
    })
  })
})
