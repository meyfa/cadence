import type { BiquadNode, DelayNode, GainNode, IdentityNode, PanNode, ReverbNode } from '@audiograph/nodes.js'
import type { Numeric } from '@core/numeric.js'
import { mulberry32, xmur3 } from '@core/random.js'
import { automate } from '../automation.js'
import type { Transport } from '../transport.js'
import type { Instance } from './instance.js'

export function createIdentityInstance (node: IdentityNode, transport: Transport): Instance {
  return toInstance(transport.ctx.createGain())
}

export function createGainInstance (node: GainNode, transport: Transport): Instance {
  const audioNode = transport.ctx.createGain()
  automate(transport, audioNode.gain, node.gain)
  return toInstance(audioNode)
}

export function createPanInstance (node: PanNode, transport: Transport): Instance {
  // equal power panning
  const audioNode = transport.ctx.createStereoPanner()
  audioNode.pan.value = node.pan.value
  return toInstance(audioNode)
}

export function createBiquadInstance (node: BiquadNode, transport: Transport): Instance {
  const audioNode = transport.ctx.createBiquadFilter()
  audioNode.type = node.filterType
  audioNode.frequency.value = node.frequency.value
  audioNode.Q.value = -node.rolloffPerOctave.value
  return toInstance(audioNode)
}

export function createDelayInstance (node: DelayNode, transport: Transport): Instance {
  const audioNode = transport.ctx.createDelay()
  audioNode.delayTime.value = node.time.value
  return toInstance(audioNode)
}

export function createReverbInstance (node: ReverbNode, transport: Transport): Instance {
  const audioNode = transport.ctx.createConvolver()
  const promise = generateReverbImpulseResponse(transport.ctx, node.decay).then((buffer) => {
    audioNode.buffer = buffer
  })
  return toInstance(audioNode, promise)
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
