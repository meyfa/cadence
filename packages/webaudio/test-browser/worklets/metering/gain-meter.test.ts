import { describe, expect, it } from 'vitest'
import { createGainMeter } from '../../../src/worklets/metering/factory.js'
import type { GainMeasurement } from '../../../src/worklets/metering/messages.js'

describe('worklets/metering/gain-meter.worklet.js', () => {
  it('reports stereo RMS and peak at render-quantum boundaries once the interval has elapsed', async () => {
    const interval = 192
    const sampleRate = 48_000
    const quantum = 128
    const length = quantum * 4
    const ctx = new OfflineAudioContext({ sampleRate, length, numberOfChannels: 2 })
    const instance = await createGainMeter(ctx, { interval })
    const measurements: GainMeasurement[] = []
    const unsubscribe = instance.measurements.subscribe((measurement) => {
      if (measurement != null) {
        measurements.push(measurement)
      }
    })

    try {
      const input = ctx.createBuffer(2, length, sampleRate)
      const left = input.getChannelData(0)
      const right = input.getChannelData(1)

      left.fill(0.5, 0, quantum)
      left.fill(-1, quantum, quantum * 2)
      left.fill(0.25, quantum * 2, quantum * 3)

      right.fill(-0.25, 0, quantum)
      right.fill(0.75, quantum, quantum * 2)
      right.fill(-0.5, quantum * 2, quantum * 3)

      const source = ctx.createBufferSource()
      source.buffer = input

      source.connect(instance.node)
      instance.node.connect(ctx.destination)

      source.start(0)
      await ctx.startRendering()

      await expect.poll(() => measurements.length).toBe(3)
      expect(measurements[0]?.rms).toEqual([expect.closeTo(0.5, 6), expect.closeTo(0.25, 6)])
      expect(measurements[0]?.peak).toEqual([expect.closeTo(0.5, 6), expect.closeTo(0.25, 6)])
      expect(measurements[1]?.rms).toEqual([expect.closeTo(1, 6), expect.closeTo(0.75, 6)])
      expect(measurements[1]?.peak).toEqual([expect.closeTo(1, 6), expect.closeTo(0.75, 6)])
      expect(measurements[2]?.rms).toEqual([expect.closeTo(0.25, 6), expect.closeTo(0.5, 6)])
      expect(measurements[2]?.peak).toEqual([expect.closeTo(0.25, 6), expect.closeTo(0.5, 6)])
    } finally {
      unsubscribe()
      instance.dispose()
    }
  })

  it('mirrors mono input measurements to both reported channels', async () => {
    const interval = 128
    const sampleRate = 48_000
    const length = interval * 2
    const ctx = new OfflineAudioContext({ sampleRate, length, numberOfChannels: 1 })
    const instance = await createGainMeter(ctx, { interval })
    const measurements: GainMeasurement[] = []
    const unsubscribe = instance.measurements.subscribe((measurement) => {
      if (measurement != null) {
        measurements.push(measurement)
      }
    })

    try {
      const input = ctx.createBuffer(1, length, sampleRate)
      const mono = input.getChannelData(0)

      mono.fill(0.5, 0, interval)
      mono.fill(-0.25, interval, length)

      const source = ctx.createBufferSource()
      source.buffer = input

      source.connect(instance.node)
      instance.node.connect(ctx.destination)

      source.start(0)
      await ctx.startRendering()

      await expect.poll(() => measurements.length).toBe(2)
      expect(measurements[0]?.rms).toEqual([expect.closeTo(0.5, 6), expect.closeTo(0.5, 6)])
      expect(measurements[0]?.peak).toEqual([expect.closeTo(0.5, 6), expect.closeTo(0.5, 6)])
      expect(measurements[1]?.rms).toEqual([expect.closeTo(0.25, 6), expect.closeTo(0.25, 6)])
      expect(measurements[1]?.peak).toEqual([expect.closeTo(0.25, 6), expect.closeTo(0.25, 6)])
    } finally {
      unsubscribe()
      instance.dispose()
    }
  })
})
