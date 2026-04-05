import { validateCopyFromChannelArgs } from './errors.js'
import type { AudioBufferLike } from './types.js'

export class ConcatenatedAudioBuffer implements AudioBufferLike {
  readonly sampleRate: number
  readonly numberOfChannels: number
  readonly length: number
  private buffers: readonly AudioBufferLike[]

  constructor (buffers: readonly AudioBufferLike[]) {
    if (buffers.length === 0) {
      throw new Error('Cannot concatenate zero audio buffers.')
    }

    this.sampleRate = buffers[0].sampleRate
    this.numberOfChannels = buffers[0].numberOfChannels
    this.length = buffers.reduce((sum, buffer) => sum + buffer.length, 0)
    this.buffers = buffers

    for (const buffer of buffers) {
      if (buffer.sampleRate !== this.sampleRate) {
        throw new Error('Cannot concatenate audio buffers with different sample rates.')
      }
      if (buffer.numberOfChannels !== this.numberOfChannels) {
        throw new Error('Cannot concatenate audio buffers with different numbers of channels.')
      }
    }
  }

  copyFromChannel (dest: Float32Array<ArrayBuffer>, channel: number, start: number) {
    validateCopyFromChannelArgs(this, dest, channel, start)

    let destOffset = 0
    let sourceOffset = start

    for (const buffer of this.buffers) {
      if (sourceOffset >= buffer.length) {
        sourceOffset -= buffer.length
        continue
      }

      const copyCount = Math.max(0, Math.min(buffer.length - sourceOffset, dest.length - destOffset))
      if (copyCount === 0) {
        break
      }

      buffer.copyFromChannel(dest.subarray(destOffset, destOffset + copyCount), channel, sourceOffset)
      destOffset += copyCount
      sourceOffset = 0
    }
  }
}
