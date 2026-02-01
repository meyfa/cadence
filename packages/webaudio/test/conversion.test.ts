import assert from 'node:assert'
import { describe, it } from 'node:test'
import { dbToGain } from '../src/conversion.js'

describe('conversion.ts', () => {
  describe('dbToGain', () => {
    it('should convert decibels to gain correctly', () => {
      assert.strictEqual(dbToGain(0), 1)
      assert.strictEqual(dbToGain(-Infinity), 0)

      const gain6 = dbToGain(6)
      assert.ok(Math.abs(gain6 - 1.9952623149688795) < 1e-10)

      const gainNeg6 = dbToGain(-6)
      assert.ok(Math.abs(gainNeg6 - 0.5011872336272722) < 1e-10)

      const gain20 = dbToGain(20)
      assert.ok(Math.abs(gain20 - 10) < 1e-10)

      const gainNeg20 = dbToGain(-20)
      assert.ok(Math.abs(gainNeg20 - 0.1) < 1e-10)
    })
  })
})
