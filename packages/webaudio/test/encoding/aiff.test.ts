import assert from 'node:assert'
import { describe, it } from 'node:test'
import { encodeAIFF, estimateAIFFSize } from '../../src/encoding/aiff.js'
import type { AudioDescription } from '../../src/encoding/common.js'
import { MockAudioBuffer } from '../../src/encoding/mock-audio-buffer.js'

describe('encoding/aiff.ts', () => {
  it('estimates file size correctly', () => {
    const stereo10s: AudioDescription = {
      numberOfChannels: 2,
      length: 441_000 // 10 seconds at 44.1kHz
    }

    // AIFF: FORM(12) + COMM(8 + 18) + SSND(8 + 8 + data)
    assert.strictEqual(estimateAIFFSize(stereo10s, { format: 'pcm16' }), 54 + 441_000 * 2 * 2)
    assert.strictEqual(estimateAIFFSize(stereo10s, { format: 'pcm24' }), 54 + 441_000 * 2 * 3)
    assert.strictEqual(estimateAIFFSize(stereo10s, { format: 'pcm32' }), 54 + 441_000 * 2 * 4)

    // AIFC adds FVER (12 bytes) + compression info to COMM; with our settings this makes the header 24 bytes larger.
    assert.strictEqual(estimateAIFFSize(stereo10s, { format: 'float32' }), 78 + 441_000 * 2 * 4)
  })

  it('encodes pcm16 correctly (big-endian)', () => {
    const samples = new Float32Array([1.2, 0.25, -0.25, -1.2])
    const audio = new MockAudioBuffer(44_100, [samples])
    const buf = encodeAIFF(audio as any, { format: 'pcm16' })

    assert.strictEqual(buf.byteLength, 54 + samples.length * 2)
    const view = new DataView(buf)

    assert.strictEqual(view.getUint32(0), 0x464F524D) // 'FORM'
    assert.strictEqual(view.getUint32(4), buf.byteLength - 8) // file size - 8
    assert.strictEqual(view.getUint32(8), 0x41494646) // 'AIFF'

    assert.strictEqual(view.getUint32(12), 0x434F4D4D) // 'COMM'
    assert.strictEqual(view.getUint32(16), 18)
    assert.strictEqual(view.getUint16(20), 1) // channels
    assert.strictEqual(view.getUint32(22), 4) // sample frames
    assert.strictEqual(view.getUint16(26), 16) // bits per sample

    // 44_100 as 80-bit extended: 40 0E AC 44 00 00 00 00 00 00
    assert.deepStrictEqual(new Uint8Array(buf.slice(28, 38)), new Uint8Array([
      0x40, 0x0E, 0xAC, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]))

    assert.strictEqual(view.getUint32(38), 0x53534E44) // 'SSND'
    assert.strictEqual(view.getUint32(42), 8 + samples.length * 2)
    assert.strictEqual(view.getUint32(46), 0) // offset
    assert.strictEqual(view.getUint32(50), 0) // block size

    // Audio data begins at 54
    assert.deepStrictEqual(new Uint8Array(buf.slice(54, 62)), new Uint8Array([
      0x7F, 0xFF, // 1.2 (clamped to 1.0)
      0x20, 0x00, // 0.25
      0xE0, 0x00, // -0.25
      0x80, 0x00 // -1.2 (clamped to -1.0)
    ]))
  })

  it('encodes pcm24 correctly (big-endian)', () => {
    const samples = new Float32Array([1.2, 0.25, -0.25, -1.2])
    const audio = new MockAudioBuffer(44_100, [samples])
    const buf = encodeAIFF(audio as any, { format: 'pcm24' })

    assert.strictEqual(buf.byteLength, 54 + samples.length * 3)
    assert.deepStrictEqual(new Uint8Array(buf.slice(54, 66)), new Uint8Array([
      0x7F, 0xFF, 0xFF, // 1.2 (clamped to 1.0)
      0x20, 0x00, 0x00, // 0.25
      0xE0, 0x00, 0x00, // -0.25
      0x80, 0x00, 0x00 // -1.2 (clamped to -1.0)
    ]))
  })

  it('pads SSND data to even size when needed', () => {
    const samples = new Float32Array([0.0])
    const audio = new MockAudioBuffer(44_100, [samples])
    const buf = encodeAIFF(audio as any, { format: 'pcm24' })

    // dataSize = 3, so SSND payload is odd and we add one pad byte.
    assert.strictEqual(buf.byteLength, 54 + 3 + 1)

    const view = new DataView(buf)
    assert.strictEqual(view.getUint32(4), buf.byteLength - 8) // FORM size includes pad
    assert.strictEqual(view.getUint32(42), 8 + 3) // SSND chunk size does NOT include pad
    assert.strictEqual(new Uint8Array(buf)[buf.byteLength - 1], 0)
  })

  it('encodes float32 as AIFC and interleaves stereo correctly (big-endian)', () => {
    const left = new Float32Array([1.0, -1.0])
    const right = new Float32Array([0.5, -0.5])
    const audio = new MockAudioBuffer(44_100, [left, right])
    const buf = encodeAIFF(audio as any, { format: 'float32' })
    const view = new DataView(buf)

    assert.strictEqual(view.getUint32(8), 0x41494643) // 'AIFC'

    // FVER chunk (AIFC format version)
    assert.strictEqual(view.getUint32(12), 0x46564552) // 'FVER'
    assert.strictEqual(view.getUint32(16), 4)
    assert.strictEqual(view.getUint32(20), 0xA2805140)

    // COMM chunk size includes compression info.
    assert.strictEqual(view.getUint32(24), 0x434F4D4D) // 'COMM'
    assert.strictEqual(view.getUint32(28), 30)

    // SSND starts after FORM(12) + FVER(12) + COMM(8+30) = 62
    assert.strictEqual(view.getUint32(62), 0x53534E44) // 'SSND'

    const dataStart = 62 + 16
    const a = view.getFloat32(dataStart + 0)
    const b = view.getFloat32(dataStart + 4)
    const c = view.getFloat32(dataStart + 8)
    const d = view.getFloat32(dataStart + 12)
    assert.deepStrictEqual([a, b, c, d], [1.0, 0.5, -1.0, -0.5])
  })
})
