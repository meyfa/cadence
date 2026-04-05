import assert from 'node:assert'
import { describe, it } from 'node:test'
import { ConcatenatedAudioBuffer } from '../../src/common/concatenated-audio-buffer.js'
import { SimpleAudioBuffer } from '../../src/common/simple-audio-buffer.js'

describe('common/concatenated-audio-buffer.ts', () => {
  it('throws when given zero buffers', () => {
    assert.throws(() => new ConcatenatedAudioBuffer([]), /zero audio buffers/i)
  })

  it('throws when sample rates differ', () => {
    const a = new SimpleAudioBuffer(44100, [new Float32Array([1])])
    const b = new SimpleAudioBuffer(48000, [new Float32Array([2])])
    assert.throws(() => new ConcatenatedAudioBuffer([a, b]), /different sample rates/i)
  })

  it('throws when channel counts differ', () => {
    const a = new SimpleAudioBuffer(44100, [new Float32Array([1]), new Float32Array([2])])
    const b = new SimpleAudioBuffer(44100, [new Float32Array([3])])
    assert.throws(() => new ConcatenatedAudioBuffer([a, b]), /different numbers of channels/i)
  })

  it('exposes expected properties', () => {
    const a = new SimpleAudioBuffer(44100, [new Float32Array([1, 2, 3])])
    const b = new SimpleAudioBuffer(44100, [new Float32Array([4, 5])])
    const c = new ConcatenatedAudioBuffer([a, b])

    assert.strictEqual(c.sampleRate, 44100)
    assert.strictEqual(c.numberOfChannels, 1)
    assert.strictEqual(c.length, 5)
  })

  describe('copyFromChannel', () => {
    it('copies data across buffer boundaries', () => {
      const a = new SimpleAudioBuffer(44100, [
        new Float32Array([1, 2, 3]),
        new Float32Array([4, 5, 6])
      ])
      const b = new SimpleAudioBuffer(44100, [
        new Float32Array([7, 8]),
        new Float32Array([9, 10])
      ])
      const c = new ConcatenatedAudioBuffer([a, b])

      const dest0 = new Float32Array(5)
      c.copyFromChannel(dest0, 0, 0)
      assert.deepStrictEqual(dest0, new Float32Array([1, 2, 3, 7, 8]))

      const dest1 = new Float32Array(5)
      c.copyFromChannel(dest1, 1, 0)
      assert.deepStrictEqual(dest1, new Float32Array([4, 5, 6, 9, 10]))
    })

    it('supports non-zero start offsets that span buffers', () => {
      const a = new SimpleAudioBuffer(44100, [new Float32Array([1, 2, 3])])
      const b = new SimpleAudioBuffer(44100, [new Float32Array([7, 8])])
      const c = new ConcatenatedAudioBuffer([a, b])

      const dest = new Float32Array([0.25, 0.25, 0.25, 0.25])
      c.copyFromChannel(dest, 0, 2)
      assert.deepStrictEqual(dest, new Float32Array([3, 7, 8, 0.25]))
    })

    it('leaves the remainder of dest untouched when reading past the end', () => {
      const a = new SimpleAudioBuffer(44100, [new Float32Array([1, 2, 3])])
      const b = new SimpleAudioBuffer(44100, [new Float32Array([7, 8])])
      const c = new ConcatenatedAudioBuffer([a, b])

      const dest = new Float32Array([0.25, 0.25, 0.25])
      c.copyFromChannel(dest, 0, 4)
      assert.deepStrictEqual(dest, new Float32Array([8, 0.25, 0.25]))
    })

    it('throws when start is at/after the end', () => {
      const a = new SimpleAudioBuffer(44100, [new Float32Array([1, 2, 3])])
      const b = new SimpleAudioBuffer(44100, [new Float32Array([7, 8])])
      const c = new ConcatenatedAudioBuffer([a, b])

      const destA = new Float32Array([0.25, 0.25])
      assert.throws(() => c.copyFromChannel(destA, 0, 5), RangeError)
      assert.deepStrictEqual(destA, new Float32Array([0.25, 0.25]))

      const destB = new Float32Array([0.25, 0.25])
      assert.throws(() => c.copyFromChannel(destB, 0, 6), RangeError)
      assert.deepStrictEqual(destB, new Float32Array([0.25, 0.25]))
    })

    it('propagates argument validation errors from underlying buffers', () => {
      const a = new SimpleAudioBuffer(44100, [new Float32Array([1, 2, 3])])
      const b = new SimpleAudioBuffer(44100, [new Float32Array([7, 8])])
      const c = new ConcatenatedAudioBuffer([a, b])

      const dest = new Float32Array(2)
      assert.throws(() => c.copyFromChannel(dest, -1, 0), RangeError)
      assert.throws(() => c.copyFromChannel(dest, 1, 0), RangeError)
      assert.throws(() => c.copyFromChannel(dest, 0, -1), RangeError)
      assert.throws(() => c.copyFromChannel(dest, 0, 5), RangeError)
    })
  })
})
