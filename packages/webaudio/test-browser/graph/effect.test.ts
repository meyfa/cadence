import type { NodeId } from '@audiograph'
import { numeric } from '@utility'
import { describe, expect, it } from 'vitest'
import { createWidthInstance } from '../../src/graph/effect.js'
import type { Transport } from '../../src/transport/transport.js'
import { average } from '../helpers.js'

describe('graph/effect.ts', () => {
  it('renders mono-compatible output when width is collapsed to zero', async () => {
    const sampleRate = 48_000
    const frameCount = 2_048

    const ctx = new OfflineAudioContext({
      numberOfChannels: 2,
      length: frameCount,
      sampleRate
    })

    const output = ctx.createGain()
    const transport: Transport = {
      ctx,
      output,
      schedule: (_time, onSchedule) => {
        onSchedule(0)
      }
    }

    const instance = createWidthInstance({
      id: 42 as NodeId,
      type: 'width',
      width: numeric(undefined, 0)
    }, transport)

    try {
      const source = ctx.createBufferSource()
      const input = ctx.createBuffer(2, frameCount, sampleRate)

      input.getChannelData(0).fill(1)
      input.getChannelData(1).fill(0)

      source.buffer = input
      source.connect(instance.input ?? ctx.destination)
      instance.output?.connect(ctx.destination)

      source.start(0)

      const rendered = await ctx.startRendering()

      const left = rendered.getChannelData(0)
      const right = rendered.getChannelData(1)

      const windowStart = 256
      const windowEnd = frameCount - 256

      expect(average(left, windowStart, windowEnd)).toBeCloseTo(0.5, 3)
      expect(average(right, windowStart, windowEnd)).toBeCloseTo(0.5, 3)
    } finally {
      instance.dispose()
    }
  })
})
