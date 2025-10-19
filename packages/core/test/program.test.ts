import { describe, it } from 'node:test'
import assert from 'node:assert'
import { makeNumeric } from '../src/program.js'

describe('program.ts', () => {
  describe('makeNumeric()', () => {
    it('should create a numeric value with the specified unit and value', () => {
      const num = makeNumeric('s', 2.5)
      assert.deepStrictEqual(num, { unit: 's', value: 2.5 })
    })
  })
})
