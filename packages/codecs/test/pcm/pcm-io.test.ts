import assert from 'node:assert'
import { describe, it } from 'node:test'
import { writeExtended80 } from '../../src/pcm/pcm-io.ts'

describe('pcm/pcm-io.ts', () => {
  describe('writeExtended80', () => {
    it('writes 44100 correctly', () => {
      const buffer = new ArrayBuffer(20)
      const view = new DataView(buffer)

      const bytesWritten = writeExtended80(view, 5, 44100)

      assert.strictEqual(bytesWritten, 10)
      assert.deepStrictEqual(new Uint8Array(buffer, 5, 10), new Uint8Array([
        0x40, 0x0E, 0xAC, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]))
    })

    it('writes positive and negative fractional values correctly', () => {
      const buffer = new ArrayBuffer(20)
      const view = new DataView(buffer)

      assert.strictEqual(writeExtended80(view, 0, 1.25), 10)
      assert.deepStrictEqual(new Uint8Array(buffer, 0, 10), new Uint8Array([
        0x3F, 0xFF, 0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]))

      assert.strictEqual(writeExtended80(view, 10, -1.25), 10)
      assert.deepStrictEqual(new Uint8Array(buffer, 10, 10), new Uint8Array([
        0xBF, 0xFF, 0xA0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]))
    })

    it('writes powers of two correctly', () => {
      const buffer = new ArrayBuffer(20)
      const view = new DataView(buffer)

      assert.strictEqual(writeExtended80(view, 0, 2), 10)
      assert.deepStrictEqual(new Uint8Array(buffer, 0, 10), new Uint8Array([
        0x40, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]))

      assert.strictEqual(writeExtended80(view, 10, 0.5), 10)
      assert.deepStrictEqual(new Uint8Array(buffer, 10, 10), new Uint8Array([
        0x3F, 0xFE, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]))
    })

    it('writes zero and non-finite values as ten zero bytes', () => {
      for (const value of [0, -0, Infinity, -Infinity, Number.NaN]) {
        const buffer = new ArrayBuffer(10)
        const view = new DataView(buffer)

        assert.strictEqual(writeExtended80(view, 0, value), 10)
        assert.deepStrictEqual(new Uint8Array(buffer), new Uint8Array(10))
      }
    })
  })
})
