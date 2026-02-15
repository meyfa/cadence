import assert from 'node:assert'
import { describe, it } from 'node:test'
import { encodeWAV } from '../../src/encoding/wav.js'
import type { AudioBufferLike } from '../../src/encoding/common.js'

class MockAudioBuffer implements AudioBufferLike {
  readonly sampleRate: number
  readonly numberOfChannels: number
  readonly length: number
  private channels: ReadonlyArray<Float32Array<ArrayBuffer>>

  constructor (sampleRate: number, channels: ReadonlyArray<Float32Array<ArrayBuffer>>) {
    this.sampleRate = sampleRate
    this.numberOfChannels = channels.length
    this.length = channels[0].length
    this.channels = channels
  }

  copyFromChannel (dest: Float32Array<ArrayBuffer>, channel: number, start: number) {
    dest.set(this.channels[channel].subarray(start, start + dest.length))
  }
}

describe('encoding/wav.ts', () => {
  it('encodes pcm16 correctly', () => {
    const samples = new Float32Array([1.2, 0.25, -0.25, -1.2])
    const audio = new MockAudioBuffer(44_100, [samples])
    const buf = encodeWAV(audio as any, { format: 'pcm16' })

    assert.strictEqual(buf.byteLength, 44 + samples.length * 2)

    const view = new DataView(buf)

    assert.strictEqual(view.getUint32(0, false), 0x52494646) // 'RIFF'
    assert.strictEqual(view.getUint16(4, true), 44) // chunk size (file size - 8)
    assert.strictEqual(view.getUint32(8, false), 0x57415645) // 'WAVE'

    assert.strictEqual(view.getUint32(12, false), 0x666d7420) // 'fmt '
    assert.strictEqual(view.getUint32(16, true), 16) // fmt chunk size
    assert.strictEqual(view.getUint16(20, true), 1) // audio format 1 = PCM
    assert.strictEqual(view.getUint16(22, true), 1) // num channels
    assert.strictEqual(view.getUint32(24, true), 44_100) // sample rate
    assert.strictEqual(view.getUint32(28, true), 88_200) // byte rate
    assert.strictEqual(view.getUint16(32, true), 2) // block align
    assert.strictEqual(view.getUint16(34, true), 16) // bits per sample

    assert.strictEqual(view.getUint32(36, false), 0x64617461) // 'data'
    assert.strictEqual(view.getUint32(40, true), 8) // data chunk size

    assert.deepStrictEqual(new Uint8Array(buf.slice(44, 52)), new Uint8Array([
      0xFF, 0x7F, // 1.2 (clamped to 1.0)
      0x00, 0x20, // 0.25
      0x00, 0xE0, // -0.25
      0x00, 0x80 // -1.2 (clamped to -1.0)
    ]))
  })

  it('encodes pcm24 correctly', () => {
    const samples = new Float32Array([1.2, 0.25, -0.25, -1.2])
    const audio = new MockAudioBuffer(44_100, [samples])
    const buf = encodeWAV(audio as any, { format: 'pcm24' })

    assert.strictEqual(buf.byteLength, 44 + samples.length * 3)

    const view = new DataView(buf)

    assert.strictEqual(view.getUint32(0, false), 0x52494646) // 'RIFF'
    assert.strictEqual(view.getUint16(4, true), 48) // chunk size (file size - 8)
    assert.strictEqual(view.getUint32(8, false), 0x57415645) // 'WAVE'

    assert.strictEqual(view.getUint32(12, false), 0x666d7420) // 'fmt '
    assert.strictEqual(view.getUint32(16, true), 16) // fmt chunk size
    assert.strictEqual(view.getUint16(20, true), 1) // audio format 1 = PCM
    assert.strictEqual(view.getUint16(22, true), 1) // num channels
    assert.strictEqual(view.getUint32(24, true), 44_100) // sample rate
    assert.strictEqual(view.getUint32(28, true), 132_300) // byte rate
    assert.strictEqual(view.getUint16(32, true), 3) // block align
    assert.strictEqual(view.getUint16(34, true), 24) // bits per sample

    assert.strictEqual(view.getUint32(36, false), 0x64617461) // 'data'
    assert.strictEqual(view.getUint32(40, true), 12) // data chunk size

    assert.deepStrictEqual(new Uint8Array(buf.slice(44, 56)), new Uint8Array([
      0xFF, 0xFF, 0x7F, // 1.2 (clamped to 1.0)
      0x00, 0x00, 0x20, // 0.25
      0x00, 0x00, 0xE0, // -0.25
      0x00, 0x00, 0x80 // -1.2 (clamped to -1.0)
    ]))
  })

  it('encodes pcm32 correctly', () => {
    const samples = new Float32Array([1.2, 0.25, -0.25, -1.2])
    const audio = new MockAudioBuffer(44_100, [samples])
    const buf = encodeWAV(audio as any, { format: 'pcm32' })

    assert.strictEqual(buf.byteLength, 44 + samples.length * 4)

    const view = new DataView(buf)

    assert.strictEqual(view.getUint32(0, false), 0x52494646) // 'RIFF'
    assert.strictEqual(view.getUint16(4, true), 52) // chunk size (file size - 8)
    assert.strictEqual(view.getUint32(8, false), 0x57415645) // 'WAVE'

    assert.strictEqual(view.getUint32(12, false), 0x666d7420) // 'fmt '
    assert.strictEqual(view.getUint32(16, true), 16) // fmt chunk size
    assert.strictEqual(view.getUint16(20, true), 1) // audio format 1 = PCM
    assert.strictEqual(view.getUint16(22, true), 1) // num channels
    assert.strictEqual(view.getUint32(24, true), 44_100) // sample rate
    assert.strictEqual(view.getUint32(28, true), 176_400) // byte rate
    assert.strictEqual(view.getUint16(32, true), 4) // block align
    assert.strictEqual(view.getUint16(34, true), 32) // bits per sample

    assert.strictEqual(view.getUint32(36, false), 0x64617461) // 'data'
    assert.strictEqual(view.getUint32(40, true), 16) // data chunk size

    assert.deepStrictEqual(new Uint8Array(buf.slice(44, 60)), new Uint8Array([
      0xFF, 0xFF, 0xFF, 0x7F, // 1.2 (clamped to 1.0)
      0x00, 0x00, 0x00, 0x20, // 0.25
      0x00, 0x00, 0x00, 0xE0, // -0.25
      0x00, 0x00, 0x00, 0x80 // -1.2 (clamped to -1.0)
    ]))
  })

  it('encodes float32 correctly', () => {
    const samples = new Float32Array([1.2, 0.25, -0.25, -1.2])
    const audio = new MockAudioBuffer(44_100, [samples])
    const buf = encodeWAV(audio as any, { format: 'float32' })

    assert.strictEqual(buf.byteLength, 44 + samples.length * 4)

    const view = new DataView(buf)

    assert.strictEqual(view.getUint32(0, false), 0x52494646) // 'RIFF'
    assert.strictEqual(view.getUint16(4, true), 52) // chunk size (file size - 8)
    assert.strictEqual(view.getUint32(8, false), 0x57415645) // 'WAVE'

    assert.strictEqual(view.getUint32(12, false), 0x666d7420) // 'fmt '
    assert.strictEqual(view.getUint32(16, true), 16) // fmt chunk size
    assert.strictEqual(view.getUint16(20, true), 3) // audio format 3 = IEEE float
    assert.strictEqual(view.getUint16(22, true), 1) // num channels
    assert.strictEqual(view.getUint32(24, true), 44_100) // sample rate
    assert.strictEqual(view.getUint32(28, true), 176_400) // byte rate
    assert.strictEqual(view.getUint16(32, true), 4) // block align
    assert.strictEqual(view.getUint16(34, true), 32) // bits per sample

    assert.strictEqual(view.getUint32(36, false), 0x64617461) // 'data'
    assert.strictEqual(view.getUint32(40, true), 16) // data chunk size

    assert.deepStrictEqual(new Float32Array(buf.slice(44)), samples)
  })

  it('encodes stereo float32 interleaved correctly', () => {
    const left = new Float32Array([1.0, -1.0])
    const right = new Float32Array([0.5, -0.5])
    const audio = new MockAudioBuffer(44_100, [left, right])
    const buf = encodeWAV(audio as any, { format: 'float32' })

    const view = new DataView(buf)

    assert.strictEqual(view.getUint16(32, true), 8) // block align = channels * 4
    assert.strictEqual(view.getUint32(28, true), 44_100 * 8) // byte rate

    const data = new Float32Array(buf.slice(44))
    assert.deepStrictEqual(data, new Float32Array([1.0, 0.5, -1.0, -0.5]))
  })

  it('handles exact +1.0 and -1.0 boundaries for pcm formats', () => {
    const samples = new Float32Array([1.0, -1.0])
    const audio = new MockAudioBuffer(44_100, [samples])

    const buf16 = encodeWAV(audio as any, { format: 'pcm16' })
    assert.deepStrictEqual(new Uint8Array(buf16.slice(44, 48)), new Uint8Array([
      0xFF, 0x7F, // +1.0
      0x00, 0x80 // -1.0
    ]))

    const buf24 = encodeWAV(audio as any, { format: 'pcm24' })
    assert.deepStrictEqual(new Uint8Array(buf24.slice(44, 50)), new Uint8Array([
      0xFF, 0xFF, 0x7F, // +1.0
      0x00, 0x00, 0x80 // -1.0
    ]))

    const buf32 = encodeWAV(audio as any, { format: 'pcm32' })
    assert.deepStrictEqual(new Uint8Array(buf32.slice(44, 52)), new Uint8Array([
      0xFF, 0xFF, 0xFF, 0x7F, // +1.0
      0x00, 0x00, 0x00, 0x80 // -1.0
    ]))
  })

  it('handles NaN and Infinity values predictably', () => {
    const samples = new Float32Array([Number.NaN, Infinity, -Infinity])
    const audio = new MockAudioBuffer(44_100, [samples])

    // Integer formats: NaN -> 0, Infinity -> clamped to +1, -Infinity -> clamped to -1
    const buf16 = encodeWAV(audio as any, { format: 'pcm16' })
    assert.deepStrictEqual(new Uint8Array(buf16.slice(44, 50)), new Uint8Array([
      0x00, 0x00, // NaN -> 0
      0xFF, 0x7F, // +Infinity -> +1.0
      0x00, 0x80 // -Infinity -> -1.0
    ]))

    // Float format preserves NaN/Infinity bit patterns
    const bufFloat = encodeWAV(audio as any, { format: 'float32' })
    const floats = new Float32Array(bufFloat.slice(44))
    assert(Number.isNaN(floats[0]))
    assert.strictEqual(floats[1], Infinity)
    assert.strictEqual(floats[2], -Infinity)
  })

  it('encodes zero-length buffers correctly', () => {
    const samples = new Float32Array([])
    const audio = new MockAudioBuffer(44_100, [samples])
    const buf = encodeWAV(audio as any, { format: 'pcm16' })

    assert.strictEqual(buf.byteLength, 44)
    const view = new DataView(buf)
    assert.strictEqual(view.getUint32(36, false), 0x64617461) // 'data'
    assert.strictEqual(view.getUint32(40, true), 0) // data chunk size
    assert.strictEqual(view.getUint16(4, true), 36) // chunk size (file size - 8)
  })
})
