import type { Numeric } from '@meyfa/cadence-utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { generateReverbImpulseResponse } from '../../src/graph/noise.js'

class MockAudioBuffer {
  readonly length: number
  readonly numberOfChannels: number
  readonly sampleRate: number
  private channels: Float32Array[]

  constructor (options: AudioBufferOptions) {
    this.length = options.length
    this.numberOfChannels = options.numberOfChannels ?? 1
    this.sampleRate = options.sampleRate

    this.channels = Array.from({ length: this.numberOfChannels }, () => new Float32Array(this.length))
  }

  copyToChannel (source: Float32Array, channelNumber: number, startInChannel = 0): void {
    const channel = this.channels.at(channelNumber)
    if (channel == null) {
      throw new Error()
    }

    channel.set(source.subarray(0, source.length), startInChannel)
  }

  getChannelData (channelNumber: number): Float32Array {
    const channel = this.channels.at(channelNumber)
    if (channel == null) {
      throw new Error()
    }
    return channel
  }
}

describe('graph/noise.ts', () => {
  describe('generateReverbImpulseResponse', () => {
    it('generates an impulse response with the expected properties', () => {
      const sampleRate = 44_100
      const decay = 1.5 as Numeric<'s'>

      const ir = generateReverbImpulseResponse({
        createBuffer: (options) => new MockAudioBuffer(options) as any as AudioBuffer,
        numberOfChannels: 4,
        sampleRate,
        decay
      })

      const expectedLength = Math.max(1, Math.floor(sampleRate * decay))
      assert.strictEqual(ir.length, expectedLength, `Expected impulse response length to be ${expectedLength}, but got ${ir.length}`)

      assert.strictEqual(ir.numberOfChannels, 4)
      assert.strictEqual(ir.sampleRate, sampleRate)
    })

    it('generates an impulse response with a decaying envelope', () => {
      const sampleRate = 44_100
      const decay = 2 as Numeric<'s'>

      const ir = generateReverbImpulseResponse({
        createBuffer: (options) => new MockAudioBuffer(options) as any as AudioBuffer,
        numberOfChannels: 1,
        sampleRate,
        decay
      })

      const channelData = ir.getChannelData(0)

      // Compute average value for first and second half
      const firstHalfAvg = channelData.slice(0, channelData.length / 2).reduce((sum, value) => sum + Math.abs(value), 0) / (channelData.length / 2)
      const secondHalfAvg = channelData.slice(channelData.length / 2).reduce((sum, value) => sum + Math.abs(value), 0) / (channelData.length / 2)

      // The average amplitude in the second half should be significantly lower than the first half due to the decay
      assert(secondHalfAvg < firstHalfAvg * 0.1, `Expected second half average (${secondHalfAvg}) to be less than 10% of first half average (${firstHalfAvg})`)
    })

    it('generates different noise for different channels', () => {
      const sampleRate = 44_100
      const decay = 1 as Numeric<'s'>

      const ir = generateReverbImpulseResponse({
        createBuffer: (options) => new MockAudioBuffer(options) as any as AudioBuffer,
        numberOfChannels: 2,
        sampleRate,
        decay
      })

      const channelData1 = ir.getChannelData(0)
      const channelData2 = ir.getChannelData(1)

      // The two channels should not be identical
      assert.notDeepStrictEqual(channelData1, channelData2, 'Expected different noise patterns for different channels')
    })

    it('handles long decay times without errors', () => {
      const sampleRate = 44_100
      const decay = 30 as Numeric<'s'>

      const ir = generateReverbImpulseResponse({
        createBuffer: (options) => new MockAudioBuffer(options) as any as AudioBuffer,
        numberOfChannels: 1,
        sampleRate,
        decay
      })

      assert.strictEqual(ir.length, Math.max(1, Math.floor(sampleRate * decay)))
    })
  })
})
