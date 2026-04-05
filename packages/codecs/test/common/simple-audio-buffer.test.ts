import assert from 'node:assert'
import { describe, it } from 'node:test'
import { SimpleAudioBuffer } from '../../src/common/simple-audio-buffer.js'

describe('common/simple-audio-buffer.ts', () => {
  it('should have correct properties', () => {
    const sampleRate = 44100
    const channels = [
      new Float32Array([0, 0.5, 1]),
      new Float32Array([0, -0.5, -1])
    ]

    const buffer = new SimpleAudioBuffer(sampleRate, channels)

    assert.strictEqual(buffer.sampleRate, sampleRate)
    assert.strictEqual(buffer.numberOfChannels, channels.length)
    assert.strictEqual(buffer.length, channels[0].length)
  })

  it('should throw if channels array is empty', () => {
    assert.throws(() => new SimpleAudioBuffer(44100, []), /at least one channel/)
  })

  it('should throw if channels have different lengths', () => {
    const channels = [
      new Float32Array([0, 0.5, 1]),
      new Float32Array([0, -0.5])
    ]

    assert.throws(() => new SimpleAudioBuffer(44100, channels), /same length/)
  })

  describe('copyFromChannel', () => {
    it('copies data correctly', () => {
      const channels = [
        new Float32Array([0, 0.5, 1]),
        new Float32Array([0, -0.5, -1])
      ]

      const buffer = new SimpleAudioBuffer(44100, channels)
      const dest = new Float32Array(3)

      buffer.copyFromChannel(dest, 0, 0)
      assert.deepStrictEqual(dest, channels[0])

      buffer.copyFromChannel(dest, 1, 0)
      assert.deepStrictEqual(dest, channels[1])
    })

    it('handles out-of-bounds channel index', () => {
      const buffer = new SimpleAudioBuffer(44100, [new Float32Array(3)])
      const dest = new Float32Array(3)

      assert.throws(() => buffer.copyFromChannel(dest, -1, 0), RangeError)
      assert.throws(() => buffer.copyFromChannel(dest, 1, 0), RangeError)
    })

    it('handles out-of-bounds start index', () => {
      const buffer = new SimpleAudioBuffer(44100, [new Float32Array(3)])
      const dest = new Float32Array(3)

      assert.throws(() => buffer.copyFromChannel(dest, 0, -1), RangeError)
      assert.throws(() => buffer.copyFromChannel(dest, 0, 3), RangeError)
    })

    it('handles zero-length copy', () => {
      const channels = [
        new Float32Array([0, 0.5, 1])
      ]

      const buffer = new SimpleAudioBuffer(44100, channels)
      const dest = new Float32Array(0)

      buffer.copyFromChannel(dest, 0, 0) // should not throw
    })

    it('handles partial copy when destination is shorter than remaining data', () => {
      const channels = [
        new Float32Array([0, 0.5, 1])
      ]

      const buffer = new SimpleAudioBuffer(44100, channels)
      const dest = new Float32Array(2)

      buffer.copyFromChannel(dest, 0, 1)
      assert.deepStrictEqual(dest, new Float32Array([0.5, 1]))
    })

    it('handles partial copy when destination is longer than remaining data', () => {
      const channels = [
        new Float32Array([0, 0.5, 1])
      ]

      const buffer = new SimpleAudioBuffer(44100, channels)
      const dest = new Float32Array([0.25, 0.25, 0.25, 0.25])

      buffer.copyFromChannel(dest, 0, 1)
      assert.deepStrictEqual(dest, new Float32Array([0.5, 1, 0.25, 0.25]))
    })

    it('handles partial copy when start index is near end of buffer', () => {
      const channels = [
        new Float32Array([0, 0.5, 1])
      ]

      const buffer = new SimpleAudioBuffer(44100, channels)
      const dest = new Float32Array(2)

      buffer.copyFromChannel(dest, 0, 2)
      assert.deepStrictEqual(dest, new Float32Array([1, 0]))
    })
  })
})
