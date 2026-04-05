import { numeric } from '@utility'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import { SimpleAudioBuffer } from '../../src/common/simple-audio-buffer.js'
import { createLeadingSilenceTransform } from '../../src/transforms/leading-silence.js'

describe('transforms/leading-silence.ts', () => {
  it('transforms audio by adding leading silence', () => {
    const transform = createLeadingSilenceTransform(numeric('s', 0.1))
    const input = new SimpleAudioBuffer(1000, [new Float32Array([1, 1, 1, 1, 1])])
    const output = transform(input)

    // Output should have 100 samples of silence followed by the original audio
    assert.strictEqual(output.sampleRate, input.sampleRate)
    assert.strictEqual(output.numberOfChannels, input.numberOfChannels)
    assert.strictEqual(output.length, input.length + 100)

    const expectedData = new Float32Array(105).fill(0)
    input.copyFromChannel(expectedData.subarray(100), 0, 0)

    const actualData = new Float32Array(105)
    output.copyFromChannel(actualData, 0, 0)

    assert.deepStrictEqual(actualData, expectedData)
  })

  it('throws if duration is negative', () => {
    assert.throws(() => createLeadingSilenceTransform(numeric('s', -0.1)), /non-negative/)
  })

  it('handles zero duration by returning an identity transform', () => {
    const transform = createLeadingSilenceTransform(numeric('s', 0))
    const input = new SimpleAudioBuffer(1000, [new Float32Array([1, 1, 1])])
    assert.strictEqual(transform(input), input)
  })

  it('handles non-integer sample counts by rounding up to nearest sample', () => {
    const transform = createLeadingSilenceTransform(numeric('s', 0.0011)) // 1.1 samples at 1000 Hz
    const input = new SimpleAudioBuffer(1000, [new Float32Array([1, 1, 1])])
    const output = transform(input)

    // Should add 2 samples of silence (rounding up from 1.1)
    assert.strictEqual(output.length, input.length + 2)

    const expectedData = new Float32Array(105).fill(0)
    input.copyFromChannel(expectedData.subarray(2), 0, 0)

    const actualData = new Float32Array(105)
    output.copyFromChannel(actualData, 0, 0)

    assert.deepStrictEqual(actualData, expectedData)
  })
})
