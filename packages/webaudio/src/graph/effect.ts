import type { BiquadNode, DelayNode, GainNode, IdentityNode, PanNode, ReverbNode } from '@audiograph'
import type { Transport } from '../transport/transport.js'
import { automate } from './automation.js'
import type { Instance } from './instance.js'
import { generateReverbImpulseResponse } from './noise.js'

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
  const { ctx } = transport

  const audioNode = ctx.createConvolver()

  const promise = generateReverbImpulseResponse({
    createBuffer: (options) => new AudioBuffer(options),
    numberOfChannels: ctx.destination.channelCount,
    sampleRate: ctx.sampleRate,
    decay: node.decay
  }).then((buffer) => {
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
