import { describe, expect, it } from 'vitest'
import { createTimeMeter } from '../../../src/worklets/metering/factory.js'
import type { TimeMeasurement } from '../../../src/worklets/metering/messages.js'

describe('worklets/metering/time-meter.worklet.js', () => {
  it('reports time at render-quantum boundaries once the interval has elapsed', async () => {
    const interval = 192
    const sampleRate = 48_000
    const quantum = 128
    const length = quantum * 4
    const ctx = new OfflineAudioContext({ sampleRate, length, numberOfChannels: 1 })
    const instance = await createTimeMeter(ctx, { interval })
    const measurements: TimeMeasurement[] = []
    const unsubscribe = instance.measurements.subscribe((measurement) => {
      if (measurement != null) {
        measurements.push(measurement)
      }
    })

    try {
      const input = ctx.createBuffer(1, length, sampleRate)
      const source = ctx.createBufferSource()
      source.buffer = input

      source.connect(instance.node)
      instance.node.connect(ctx.destination)

      source.start(0)
      await ctx.startRendering()

      await expect.poll(() => measurements.length).toBe(3)

      const times = measurements.map((measurement) => measurement.time)
      expect(times[0]).toBeCloseTo(0, 6)
      expect(times[1]).toBeCloseTo(quantum / sampleRate, 6)
      expect(times[2]).toBeCloseTo((quantum * 2) / sampleRate, 6)
    } finally {
      unsubscribe()
      instance.dispose()
    }
  })
})
