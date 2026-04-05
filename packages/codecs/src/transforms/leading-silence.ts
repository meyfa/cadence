import type { Numeric } from '@utility'
import { ConcatenatedAudioBuffer } from '../common/concatenated-audio-buffer.js'
import { ConstantAudioBuffer } from '../common/constant-audio-buffer.js'
import type { AudioBufferTransform } from '../common/types.js'

const identity: AudioBufferTransform = (input) => input

export function createLeadingSilenceTransform (duration: Numeric<'s'>): AudioBufferTransform {
  if (duration.value < 0) {
    throw new Error('Duration must be non-negative.')
  }

  if (duration.value === 0) {
    return identity
  }

  return (input) => {
    const silence = new ConstantAudioBuffer({
      sampleRate: input.sampleRate,
      numberOfChannels: input.numberOfChannels,
      length: Math.ceil(duration.value * input.sampleRate),
      value: 0
    })

    return new ConcatenatedAudioBuffer([silence, input])
  }
}
