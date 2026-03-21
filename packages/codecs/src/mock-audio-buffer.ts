import type { AudioBufferLike } from './common.js'

export class MockAudioBuffer implements AudioBufferLike {
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
