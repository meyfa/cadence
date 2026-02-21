import { describe, it } from 'node:test'
import { formatBytes, formatDuration } from '../../src/utilities/strings.js'
import assert from 'node:assert'
import { makeNumeric } from '@core/program.js'

describe('utilities/strings.ts', () => {
  describe('formatDuration', () => {
    it('formats durations correctly', () => {
      const testCases = [
        { input: 0, expected: '0.000s' },
        { input: 0.5, expected: '0.500s' },
        { input: 1.9996, expected: '2.000s' },
        { input: 59.999, expected: '59.999s' },
        { input: 59.9996, expected: '1m 0.000s' },
        { input: 60, expected: '1m 0.000s' },
        { input: 61.5, expected: '1m 1.500s' },
        { input: 3599.999, expected: '59m 59.999s' },
        { input: 3600, expected: '1h 0m 0.000s' },
        { input: 3661.5, expected: '1h 1m 1.500s' },

        { input: -0.5, expected: '-0.500s' },
        { input: -60, expected: '-1m 0.000s' },
        { input: -3661.5, expected: '-1h 1m 1.500s' }
      ]

      for (const { input, expected } of testCases) {
        const result = formatDuration(makeNumeric('s', input))
        assert.strictEqual(result, expected, `Expected formatDuration(${input}) to return "${expected}", got "${result}"`)
      }
    })
  })

  describe('formatBytes', () => {
    it('formats bytes correctly', () => {
      const testCases = [
        { input: 0, expected: '0 B' },
        { input: 500, expected: '500 B' },
        { input: 1023, expected: '1023 B' },

        { input: 1024, expected: '1.00 kiB' },
        { input: 1536, expected: '1.50 kiB' },
        { input: 1048570, expected: '1023.99 kiB' },
        { input: 1048575, expected: '1024.00 kiB' },

        { input: 1048576, expected: '1.00 MiB' },
        { input: 1572864, expected: '1.50 MiB' },

        { input: 1073741824, expected: '1.00 GiB' },
        { input: 1610612736, expected: '1.50 GiB' },

        { input: 1099511627776, expected: '1.00 TiB' },
        { input: 1649267441664, expected: '1.50 TiB' }
      ]

      for (const { input, expected } of testCases) {
        const result = formatBytes(input)
        assert.strictEqual(result, expected, `Expected formatBytes(${input}) to return "${expected}", got "${result}"`)
      }
    })
  })
})
