import { ErrorMessages, validateCopyFromChannelArgs } from './errors.js'
import type { AudioBufferLike } from './types.js'

export class ConstantAudioBuffer implements AudioBufferLike {
  readonly sampleRate: number
  readonly numberOfChannels: number
  readonly length: number
  private value: number

  constructor (options: {
    readonly sampleRate: number
    readonly numberOfChannels: number
    readonly length: number
    readonly value: number
  }) {
    if (options.numberOfChannels <= 0) {
      throw new Error(ErrorMessages.ZeroChannels)
    }

    if (options.length < 0) {
      throw new Error(ErrorMessages.NegativeLength)
    }

    this.sampleRate = options.sampleRate
    this.numberOfChannels = options.numberOfChannels
    this.length = options.length
    this.value = options.value
  }

  copyFromChannel (dest: Float32Array<ArrayBuffer>, channel: number, start: number) {
    validateCopyFromChannelArgs(this, dest, channel, start)

    const copyCount = Math.max(0, Math.min(this.length - start, dest.length))
    dest.fill(this.value, 0, copyCount)
  }
}
