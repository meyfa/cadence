import type { DelayNode, GainNode, HighpassNode, LowpassNode, PanNode, ReverbNode } from '@audiograph/nodes.js'
import type { Numeric } from '@core/numeric.js'
import { mulberry32, xmur3 } from '@core/random.js'
import { automate } from '../automation.js'
import type { Transport } from '../transport.js'
import type { Instance } from './types.js'

const DEFAULT_FILTER_ROLLOFF_DB_PER_OCTAVE = -12.0

export type EffectNode =
  GainNode |
  PanNode |
  LowpassNode |
  HighpassNode |
  DelayNode |
  ReverbNode

export function createEffectInstance (node: EffectNode, transport: Transport): Instance {
  const { ctx } = transport

  switch (node.type) {
    case 'gain': {
      const audioNode = ctx.createGain()
      automate(transport, audioNode.gain, node.gain)
      return toInstance(audioNode)
    }

    case 'pan': {
      // equal power panning
      const audioNode = ctx.createStereoPanner()
      audioNode.pan.value = node.pan.value
      return toInstance(audioNode)
    }

    case 'lowpass': {
      const audioNode = ctx.createBiquadFilter()
      audioNode.type = 'lowpass'
      audioNode.frequency.value = node.frequency.value
      audioNode.Q.value = DEFAULT_FILTER_ROLLOFF_DB_PER_OCTAVE
      return toInstance(audioNode)
    }

    case 'highpass': {
      const audioNode = ctx.createBiquadFilter()
      audioNode.type = 'highpass'
      audioNode.frequency.value = node.frequency.value
      audioNode.Q.value = DEFAULT_FILTER_ROLLOFF_DB_PER_OCTAVE
      return toInstance(audioNode)
    }

    case 'delay': {
      const audioNode = ctx.createDelay()
      audioNode.delayTime.value = node.time.value
      return toInstance(audioNode)
    }

    case 'reverb': {
      const audioNode = ctx.createConvolver()
      const promise = generateReverbImpulseResponse(ctx, node.decay).then((buffer) => {
        audioNode.buffer = buffer
      })
      return toInstance(audioNode, promise)
    }
  }
}

function toInstance (node: AudioNode, loaded = Promise.resolve()): Instance {
  return {
    input: node,
    output: node,
    loaded,
    dispose: () => {
      node.disconnect()
    }
  }
}

function generateReverbImpulseResponse (ctx: BaseAudioContext, decay: Numeric<'s'>): Promise<AudioBuffer> {
  const channels = 2

  // buffer length must be non-zero
  const samples = Math.max(1, Math.floor(ctx.sampleRate * decay.value))

  const renderer = new OfflineAudioContext(channels, samples, ctx.sampleRate)

  const noise = renderer.createBufferSource()
  noise.buffer = createNoiseBuffer(renderer, channels)
  noise.loop = true

  const decayGain = renderer.createGain()
  decayGain.gain.setValueAtTime(1.0, 0)

  // value must be > 0 to avoid exponentialRampToValueAtTime error
  decayGain.gain.exponentialRampToValueAtTime(0.001, decay.value)

  noise.connect(decayGain)
  decayGain.connect(renderer.destination)

  noise.start(0)

  return renderer.startRendering()
}

// 2 seconds at 44.1kHz
const noiseSamples = 44_100 * 2

// decorrelated noise buffers per channel
const noiseCache: Array<Float32Array<ArrayBuffer>> = []

function createNoiseBuffer (ctx: BaseAudioContext, channels: number): AudioBuffer {
  while (noiseCache.length < channels) {
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

  const buffer = ctx.createBuffer(channels, noiseSamples, ctx.sampleRate)
  for (let channel = 0; channel < channels; ++channel) {
    buffer.copyToChannel(noiseCache[channel], channel)
  }

  return buffer
}
