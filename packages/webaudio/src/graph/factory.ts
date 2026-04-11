import type { Node } from '@audiograph'
import type { AudioFetcher } from '../assets/fetcher.js'
import type { Transport } from '../transport/transport.js'
import { createBiquadInstance, createDelayInstance, createGainInstance, createIdentityInstance, createPanInstance, createReverbInstance, createWidthInstance } from './effect.js'
import type { Instance } from './instance.js'
import { createSampleInstance } from './sample.js'

const factories = Object.freeze({
  identity: createIdentityInstance,

  gain: createGainInstance,
  pan: createPanInstance,
  biquad: createBiquadInstance,
  width: createWidthInstance,
  delay: createDelayInstance,
  reverb: createReverbInstance,

  sample: createSampleInstance
})

export function createNodeInstance (node: Node, transport: Transport, fetcher: AudioFetcher): Instance {
  return factories[node.type](node as any, transport, fetcher)
}
