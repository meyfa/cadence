import type { AudioBufferLike } from './types.js'

export class SimpleAudioBuffer implements AudioBufferLike {
  readonly sampleRate: number
  readonly numberOfChannels: number
  readonly length: number
  private channels: ReadonlyArray<Float32Array<ArrayBuffer>>

  constructor (sampleRate: number, channels: ReadonlyArray<Float32Array<ArrayBuffer>>) {
    if (channels.length === 0) {
      throw new Error('Audio buffer must have at least one channel.')
    }

    this.sampleRate = sampleRate
    this.numberOfChannels = channels.length
    this.length = channels[0].length
    this.channels = channels

    for (const channelData of channels) {
      if (channelData.length !== this.length) {
        throw new Error('All channels must have the same length.')
      }
    }
  }

  copyFromChannel (dest: Float32Array<ArrayBuffer>, channel: number, start: number) {
    // References:
    // https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer/copyFromChannel
    // https://webaudio.github.io/web-audio-api/#dom-audiobuffer-copyfromchannel

    if (channel < 0 || channel >= this.numberOfChannels) {
      throw new RangeError(`Channel index ${channel} is out of bounds for number of channels ${this.numberOfChannels}.`)
    }

    if (start < 0 || start >= this.length) {
      throw new RangeError(`Start index ${start} is out of bounds for buffer length ${this.length}.`)
    }

    dest.set(this.channels[channel].subarray(start, start + dest.length))
  }
}
