import assert from 'node:assert'
import { describe, it } from 'node:test'
import { numeric } from '../../src/numeric/numeric.js'

describe('numeric/numeric.ts', () => {
  describe('numeric()', () => {
    it('should create a numeric value with the specified unit and value', () => {
      const num = numeric('s', 2.5)
      assert.deepStrictEqual(num, { unit: 's', value: 2.5 })
    })
  })
})
