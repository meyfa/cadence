import type { Effect, Program, ReverbEffect } from '@core/program.js'
import { mulberry32, xmur3 } from '@core/random.js'
import { beatsToSeconds } from '@core/time.js'
import { dbToGain } from './conversion.js'
import type { EffectInstance } from './instances.js'
import type { Transport } from './transport.js'

const DEFAULT_FILTER_ROLLOFF_DB_PER_OCTAVE = -12.0

export function createEffect (transport: Transport, program: Program, effect: Effect): EffectInstance {
  const { ctx } = transport

  switch (effect.type) {
    case 'gain': {
      const node = ctx.createGain()
      node.gain.value = dbToGain(effect.gain.value)
      return createEffectInstance(node)
    }

    case 'pan': {
      // equal power panning
      const node = ctx.createStereoPanner()
      node.pan.value = Math.max(-1, Math.min(1, effect.pan.value))
      return createEffectInstance(node)
    }

    case 'lowpass': {
      const node = ctx.createBiquadFilter()
      node.type = 'lowpass'
      node.frequency.value = effect.frequency.value
      node.Q.value = DEFAULT_FILTER_ROLLOFF_DB_PER_OCTAVE
      return createEffectInstance(node)
    }

    case 'highpass': {
      const node = ctx.createBiquadFilter()
      node.type = 'highpass'
      node.frequency.value = effect.frequency.value
      node.Q.value = DEFAULT_FILTER_ROLLOFF_DB_PER_OCTAVE
      return createEffectInstance(node)
    }

    case 'delay': {
      if (effect.mix.value <= 0) {
        return createEffectInstance(ctx.createGain())
      }

      const node = ctx.createDelay()
      node.delayTime.value = beatsToSeconds(effect.time, program.track.tempo).value

      if (effect.feedback.value > 0) {
        const feedbackGain = ctx.createGain()
        feedbackGain.gain.value = Math.min(1.0, effect.feedback.value)
        node.connect(feedbackGain)
        feedbackGain.connect(node)
      }

      const instance = createEffectInstance(node)

      return createDryWetMix(ctx, effect.mix.value, instance)
    }

    case 'reverb': {
      if (effect.mix.value <= 0) {
        return createEffectInstance(ctx.createGain())
      }

      const node = ctx.createConvolver()
      const promise = generateReverbImpulseResponse(ctx, effect).then((buffer) => {
        node.buffer = buffer
      })

      const instance = createEffectInstance(node, promise)

      return createDryWetMix(ctx, effect.mix.value, instance)
    }
  }
}

function createEffectInstance (node: AudioNode, loaded = Promise.resolve()): EffectInstance {
  return {
    input: node,
    output: node,
    loaded,
    dispose: () => {
      node.disconnect()
    }
  }
}

function bypass (effect: EffectInstance): EffectInstance {
  const node = effect.input.context.createGain()

  return {
    ...effect,

    input: node,
    output: node,

    dispose: () => {
      node.disconnect()
      effect.dispose()
    }
  }
}

function createDryWetMix (ctx: BaseAudioContext, mix: number, effect: EffectInstance): EffectInstance {
  if (mix <= 0) {
    return bypass(effect)
  }

  if (mix >= 1) {
    return effect
  }

  const input = ctx.createGain()
  const output = ctx.createGain()

  // dry: 0.0...0.5 -> 100%,   0.75: 50%,         1.0:   0%
  // wet:       0.0 ->   0%,   0.25: 50%,   0.5...1.0: 100%

  const dryGain = ctx.createGain()
  dryGain.gain.value = Math.max(0, Math.min(1, (1 - mix) * 2))

  const wetGain = ctx.createGain()
  wetGain.gain.value = Math.max(0, Math.min(1, mix * 2))

  input.connect(dryGain).connect(output)
  input.connect(effect.input)
  effect.output.connect(wetGain).connect(output)

  return {
    ...effect,

    input,
    output,

    dispose: () => {
      input.disconnect()
      output.disconnect()

      dryGain.disconnect()
      wetGain.disconnect()

      effect.dispose()
    }
  }
}

function generateReverbImpulseResponse (ctx: BaseAudioContext, effect: ReverbEffect): Promise<AudioBuffer> {
  const channels = 2

  // buffer length must be non-zero
  const samples = Math.max(1, Math.floor(ctx.sampleRate * effect.decay.value))

  const renderer = new OfflineAudioContext(channels, samples, ctx.sampleRate)

  const noise = renderer.createBufferSource()
  noise.buffer = createNoiseBuffer(renderer, channels)
  noise.loop = true

  const decayGain = renderer.createGain()
  decayGain.gain.setValueAtTime(1.0, 0)

  // value must be > 0 to avoid exponentialRampToValueAtTime error
  decayGain.gain.exponentialRampToValueAtTime(0.001, effect.decay.value)

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
