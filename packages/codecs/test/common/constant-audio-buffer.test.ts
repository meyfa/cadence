import assert from 'node:assert'
import { describe, it } from 'node:test'
import { ConstantAudioBuffer } from '../../src/common/constant-audio-buffer.js'

describe('common/constant-audio-buffer.ts', () => {
  it('should have correct properties', () => {
    const sampleRate = 44100
    const numberOfChannels = 2
    const length = 44100
    const value = 0.5

    const buffer = new ConstantAudioBuffer({ sampleRate, numberOfChannels, length, value })

    assert.strictEqual(buffer.sampleRate, sampleRate)
    assert.strictEqual(buffer.numberOfChannels, numberOfChannels)
    assert.strictEqual(buffer.length, length)
  })

  it('should throw if number of channels is zero or negative', () => {
    assert.throws(() => new ConstantAudioBuffer({ sampleRate: 44100, numberOfChannels: 0, length: 44100, value: 0 }), /at least one channel/)
    assert.throws(() => new ConstantAudioBuffer({ sampleRate: 44100, numberOfChannels: -1, length: 44100, value: 0 }), /at least one channel/)
  })

  it('should throw if length is negative', () => {
    assert.throws(() => new ConstantAudioBuffer({ sampleRate: 44100, numberOfChannels: 2, length: -1, value: 0 }), /negative/)
  })

  describe('copyFromChannel', () => {
    it('copies constant value correctly', () => {
      const buffer = new ConstantAudioBuffer({ sampleRate: 44100, numberOfChannels: 2, length: 44100, value: 0.5 })
      const dest = new Float32Array(10)

      buffer.copyFromChannel(dest, 0, 0)
      assert.deepStrictEqual(dest, new Float32Array(10).fill(0.5))

      buffer.copyFromChannel(dest, 1, 0)
      assert.deepStrictEqual(dest, new Float32Array(10).fill(0.5))
    })

    it('handles out-of-bounds channel index', () => {
      const buffer = new ConstantAudioBuffer({ sampleRate: 44100, numberOfChannels: 2, length: 44100, value: 0 })
      const dest = new Float32Array(10)

      assert.throws(() => buffer.copyFromChannel(dest, -1, 0), RangeError)
      assert.throws(() => buffer.copyFromChannel(dest, 2, 0), RangeError)
    })

    it('handles out-of-bounds start index', () => {
      const buffer = new ConstantAudioBuffer({ sampleRate: 44100, numberOfChannels: 2, length: 44100, value: 0 })
      const dest = new Float32Array(10)

      assert.throws(() => buffer.copyFromChannel(dest, 0, -1), RangeError)
      assert.throws(() => buffer.copyFromChannel(dest, 0, 44100), RangeError)
    })

    it('handles start index near end of buffer', () => {
      const buffer = new ConstantAudioBuffer({ sampleRate: 44100, numberOfChannels: 2, length: 44100, value: 0.5 })

      const destA = new Float32Array(10)
      buffer.copyFromChannel(destA, 0, 44100 - 5)
      assert.deepStrictEqual(destA, new Float32Array(10).fill(0.5, 0, 5).fill(0, 5))

      const destB = new Float32Array(10)
      buffer.copyFromChannel(destB, 1, 44100 - 3)
      assert.deepStrictEqual(destB, new Float32Array(10).fill(0.5, 0, 3).fill(0, 3))
    })

    it('handles zero-length copy', () => {
      const buffer = new ConstantAudioBuffer({ sampleRate: 44100, numberOfChannels: 2, length: 44100, value: 0.5 })
      const dest = new Float32Array(0)

      buffer.copyFromChannel(dest, 0, 0)
      assert.deepStrictEqual(dest, new Float32Array(0))

      buffer.copyFromChannel(dest, 1, 0)
      assert.deepStrictEqual(dest, new Float32Array(0))
    })
  })
})
