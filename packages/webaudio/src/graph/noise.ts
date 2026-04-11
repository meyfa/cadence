import { mulberry32, xmur3, type Numeric } from '@utility'

type CreateAudioBuffer = (options: AudioBufferOptions) => AudioBuffer

// Target decay of the noise envelope is -60 dB (RT60)
const reverbDecayDb = 60
const reverbDecayTarget = Math.pow(10, -reverbDecayDb / 20)

export function generateReverbImpulseResponse (options: {
  readonly createBuffer: CreateAudioBuffer
  readonly numberOfChannels: number
  readonly sampleRate: number
  readonly decay: Numeric<'s'>
}): Promise<AudioBuffer> {
  const { sampleRate, numberOfChannels, decay, createBuffer } = options

  // buffer length must be non-zero
  const length = Math.max(1, Math.floor(sampleRate * decay.value))

  const noise = createNoiseBuffer({ numberOfChannels, sampleRate, createBuffer })
  const ir = createBuffer({ length, numberOfChannels, sampleRate })

  const exponentScale = length > 1 ? Math.log(reverbDecayTarget) / (length - 1) : 0

  for (let channel = 0; channel < numberOfChannels; ++channel) {
    const input = noise.getChannelData(channel)
    const output = ir.getChannelData(channel)

    for (let i = 0; i < length; ++i) {
      output[i] = input[i % input.length] * Math.exp(exponentScale * i)
    }
  }

  return Promise.resolve(ir)
}

// 2 seconds at 44.1kHz
const noiseSamples = 44_100 * 2

// decorrelated noise buffers per channel
const noiseCache: Array<Float32Array<ArrayBuffer>> = []

function createNoiseBuffer (options: {
  readonly createBuffer: CreateAudioBuffer
  readonly numberOfChannels: number
  readonly sampleRate: number
}): AudioBuffer {
  const { sampleRate, numberOfChannels, createBuffer } = options

  while (noiseCache.length < numberOfChannels) {
    const channel = noiseCache.length
    const seed = xmur3(`cadence webaudio noise channel ${channel}`)()
    const rng = mulberry32(seed)

    // generate white noise
    const data = new Float32Array(noiseSamples)
    for (let i = 0; i < noiseSamples; ++i) {
      data[i] = rng() * 2 - 1
    }

    noiseCache.push(data)
  }

  const length = noiseSamples
  const buffer = createBuffer({ length, numberOfChannels, sampleRate })

  for (let channel = 0; channel < numberOfChannels; ++channel) {
    buffer.copyToChannel(noiseCache[channel], channel)
  }

  return buffer
}
