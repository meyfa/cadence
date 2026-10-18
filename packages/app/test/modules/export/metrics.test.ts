import { estimateAIFFSize, estimateWAVSize } from '@meyfa/cadence-codecs'
import type { Program } from '@meyfa/cadence-core'
import type { Numeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { computeExportMetrics } from '../../../src/modules/export/metrics.ts'

function createProgram (tempo: number, partLengths: readonly number[]): Program {
  return {
    track: {
      tempo: tempo as Numeric<'bpm'>,
      parts: partLengths.map((length) => ({ length: length as Numeric<'beats'>, routings: [], automations: [] }))
    }
  } as unknown as Program
}

describe('modules/export/metrics.ts', () => {
  describe('computeExportMetrics()', () => {
    it('computes the duration from tempo and part lengths', () => {
      const program = createProgram(120, [4, 4])
      assert.strictEqual(computeExportMetrics(program, {}).duration, 4)
    })

    it('adds leading silence to the duration', () => {
      const program = createProgram(120, [4, 4])
      assert.strictEqual(computeExportMetrics(program, { leadingSilence: '0.500' }).duration, 4.5)
    })

    it('estimates the WAV file size', () => {
      const program = createProgram(120, [8])
      const form = { 'wav.format': 'pcm16', sampleRate: '48000' }

      const expected = estimateWAVSize({ length: 4 * 48000, numberOfChannels: 2 }, { format: 'pcm16' })
      assert.strictEqual(computeExportMetrics(program, form).fileSize, expected)
    })

    it('estimates the AIFF file size', () => {
      const program = createProgram(120, [8])
      const form = { type: 'aiff', 'aiff.format': 'pcm24', sampleRate: '96000' }

      const expected = estimateAIFFSize({ length: 4 * 96000, numberOfChannels: 2 }, { format: 'pcm24' })
      assert.strictEqual(computeExportMetrics(program, form).fileSize, expected)
    })
  })
})
