import type { Effect, Program } from '@core/program.js'
import { FeedbackDelay, Gain, Panner, Reverb, type ToneAudioNode } from 'tone'
import { beatsToSeconds } from './time.js'
import type { EffectInstance } from './instances.js'

export function createEffect (program: Program, effect: Effect): EffectInstance {
  switch (effect.type) {
    case 'gain': {
      const node = new Gain(effect.gain.value, 'decibels')
      return createEffectInstance(node)
    }

    case 'pan': {
      const node = new Panner(Math.max(-1, Math.min(1, effect.pan.value)))
      return createEffectInstance(node)
    }

    case 'delay': {
      const node = new FeedbackDelay({
        delayTime: beatsToSeconds(effect.time, program.track.tempo).value,
        feedback: Math.max(0, Math.min(1.0, effect.feedback.value))
      })
      return createEffectInstance(node)
    }

    case 'reverb': {
      const node = new Reverb({
        decay: effect.decay.value,
        wet: Math.max(0, Math.min(1.0, effect.mix.value))
      })
      return createEffectInstance(node, node.generate().then(() => undefined))
    }
  }
}

function createEffectInstance (node: ToneAudioNode, loaded = Promise.resolve()): EffectInstance {
  return {
    input: node,
    output: node,
    loaded,
    dispose: () => {
      node.dispose()
    }
  }
}
