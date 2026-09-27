import type { Numeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { formatBeatDuration, formatBeatDurationAsWords, formatBytes, formatDuration, pluralize } from '../../src/utilities/format.ts'

describe('utilities/format.ts', () => {
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
        const result = formatDuration(input as Numeric<'s'>)
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
        const result = formatBytes(input as Numeric<'bytes'>)
        assert.strictEqual(result, expected, `Expected formatBytes(${input}) to return "${expected}", got "${result}"`)
      }
    })
  })

  describe('pluralize', () => {
    it('uses the singular form for a count of 1', () => {
      assert.strictEqual(pluralize(1, 'bar'), '1 bar')
    })

    it('uses the default plural form (appending "s") for other counts', () => {
      assert.strictEqual(pluralize(0, 'bar'), '0 bars')
      assert.strictEqual(pluralize(2, 'bar'), '2 bars')
    })

    it('appends "es" instead of "s" when the singular already ends in "s"', () => {
      assert.strictEqual(pluralize(2, 'bus'), '2 buses')
    })

    it('uses an explicit plural form when given', () => {
      assert.strictEqual(pluralize(2, 'child', 'children'), '2 children')
    })
  })

  describe('formatBeatDuration', () => {
    it('formats durations shorter than a bar as beats only', () => {
      assert.strictEqual(formatBeatDuration(0 as Numeric<'beats'>, 4), '0:0.00')
      assert.strictEqual(formatBeatDuration(2.5 as Numeric<'beats'>, 4), '0:2.50')
    })

    it('formats durations spanning multiple bars', () => {
      assert.strictEqual(formatBeatDuration(4 as Numeric<'beats'>, 4), '1:0.00')
      assert.strictEqual(formatBeatDuration(6.25 as Numeric<'beats'>, 4), '1:2.25')
    })

    it('prefixes negative durations with a minus sign', () => {
      assert.strictEqual(formatBeatDuration(-6.25 as Numeric<'beats'>, 4), '-1:2.25')
    })
  })

  describe('formatBeatDurationAsWords', () => {
    it('returns "0 beats" for a zero duration', () => {
      assert.strictEqual(formatBeatDurationAsWords(0 as Numeric<'beats'>, 4), '0 beats')
    })

    it('describes durations shorter than a bar in beats only', () => {
      assert.strictEqual(formatBeatDurationAsWords(1 as Numeric<'beats'>, 4), '1 beat')
      assert.strictEqual(formatBeatDurationAsWords(2 as Numeric<'beats'>, 4), '2 beats')
    })

    it('describes durations of whole bars in bars only', () => {
      assert.strictEqual(formatBeatDurationAsWords(4 as Numeric<'beats'>, 4), '1 bar')
      assert.strictEqual(formatBeatDurationAsWords(8 as Numeric<'beats'>, 4), '2 bars')
    })

    it('describes durations combining bars and beats', () => {
      assert.strictEqual(formatBeatDurationAsWords(6 as Numeric<'beats'>, 4), '1 bar 2 beats')
    })

    it('prefixes negative durations with a minus sign', () => {
      assert.strictEqual(formatBeatDurationAsWords(-6 as Numeric<'beats'>, 4), '-1 bar 2 beats')
    })
  })
})
