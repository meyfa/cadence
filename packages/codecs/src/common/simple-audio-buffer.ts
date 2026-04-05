import { ErrorMessages, validateCopyFromChannelArgs } from './errors.js'
import type { AudioBufferLike } from './types.js'

export class SimpleAudioBuffer implements AudioBufferLike {
  readonly sampleRate: number
  readonly numberOfChannels: number
  readonly length: number
  private channels: ReadonlyArray<Float32Array<ArrayBuffer>>

  constructor (sampleRate: number, channels: ReadonlyArray<Float32Array<ArrayBuffer>>) {
    if (channels.length === 0) {
      throw new Error(ErrorMessages.ZeroChannels)
    }

    this.sampleRate = sampleRate
    this.numberOfChannels = channels.length
    this.length = channels[0].length
    this.channels = channels

    for (const channelData of channels) {
      if (channelData.length !== this.length) {
        throw new Error(ErrorMessages.InconsistentChannelLengths)
      }
    }
  }

  copyFromChannel (dest: Float32Array<ArrayBuffer>, channel: number, start: number) {
    validateCopyFromChannelArgs(this, dest, channel, start)
    dest.set(this.channels[channel].subarray(start, start + dest.length))
  }
}
