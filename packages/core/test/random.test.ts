import assert from 'node:assert'
import { describe, it } from 'node:test'
import { mulberry32, xmur3 } from '../src/random.js'

describe('random.ts', () => {
  describe('mulberry32', () => {
    it('generates a consistent sequence of numbers for a given seed', () => {
      const rng1 = mulberry32(12345)
      const rng2 = mulberry32(12345)
      const rng3 = mulberry32(67890)

      const sequence1 = Array.from({ length: 5 }, () => rng1())
      const sequence2 = Array.from({ length: 5 }, () => rng2())
      const sequence3 = Array.from({ length: 5 }, () => rng3())

      assert.deepStrictEqual(sequence1, sequence2, 'Sequences with the same seed should match')
      assert.notDeepStrictEqual(sequence1, sequence3, 'Sequences with different seeds should not match')
    })

    it('has values in the range [0, 1)', () => {
      const rng = mulberry32(54321)
      for (let i = 0; i < 100; ++i) {
        const value = rng()
        assert.ok(value >= 0 && value < 1, `Value ${value} is out of range`)
      }
    })

    it('has low DC offset over many samples', () => {
      const rng = mulberry32(98765)
      const samples = 1_000_000
      let sum = 0
      for (let i = 0; i < samples; ++i) {
        sum += rng()
      }
      const average = sum / samples
      assert.ok(Math.abs(average - 0.5) < 0.001, `Average ${average} is not close to 0.5`)
    })
  })

  describe('xmur3', () => {
    it('generates a consistent sequence of numbers for a given input', () => {
      const hash1 = xmur3('test input 1')
      const hash2 = xmur3('test input 1')
      const hash3 = xmur3('test input 2')
      const hash4 = xmur3('')

      const sequence1 = Array.from({ length: 5 }, () => hash1())
      const sequence2 = Array.from({ length: 5 }, () => hash2())
      const sequence3 = Array.from({ length: 5 }, () => hash3())
      const sequence4 = Array.from({ length: 5 }, () => hash4())

      assert.deepStrictEqual(sequence1, sequence2, 'Sequences with the same input should match')
      assert.notDeepStrictEqual(sequence1, sequence3, 'Sequences with different inputs should not match')
      assert.notDeepStrictEqual(sequence1, sequence4, 'Sequences with different inputs should not match')
    })

    it('produces unsigned 32-bit integers', () => {
      const hash = xmur3('some input')
      for (let i = 0; i < 100; ++i) {
        const value = hash()
        assert.ok(Number.isInteger(value) && value >= 0 && value <= 0xFFFFFFFF, `Value ${value} is not a valid unsigned 32-bit integer`)
      }
    })
  })
})
