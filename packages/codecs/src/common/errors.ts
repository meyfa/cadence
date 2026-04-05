import type { AudioBufferLike } from './types.js'

export const ErrorMessages = Object.freeze({
  ZeroChannels: 'Audio buffer must have at least one channel.',
  NegativeLength: 'Audio buffer length must be non-negative.',
  InconsistentChannelLengths: 'All channels must have the same length.'
})

export function validateCopyFromChannelArgs (buffer: AudioBufferLike, dest: Float32Array<ArrayBuffer>, channel: number, start: number) {
  // https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer/copyFromChannel#exceptions
  // https://webaudio.github.io/web-audio-api/#dom-audiobuffer-copyfromchannel

  if (channel < 0 || channel >= buffer.numberOfChannels) {
    throw new RangeError(`Channel index ${channel} is out of bounds for number of channels ${buffer.numberOfChannels}.`)
  }

  if (start < 0 || start >= buffer.length) {
    throw new RangeError(`Start index ${start} is out of bounds for buffer length ${buffer.length}.`)
  }
}
