import type { Node } from '@audiograph/nodes.js'
import type { AudioFetcher } from '../assets/fetcher.js'
import type { Transport } from '../transport.js'
import { createBiquadInstance, createDelayInstance, createGainInstance, createIdentityInstance, createPanInstance, createReverbInstance } from './effect.js'
import { createSampleInstance } from './sample.js'
import type { Instance } from './instance.js'

const factories = Object.freeze({
  identity: createIdentityInstance,

  gain: createGainInstance,
  pan: createPanInstance,
  biquad: createBiquadInstance,
  delay: createDelayInstance,
  reverb: createReverbInstance,

  sample: createSampleInstance
})

export function createNodeInstance (node: Node, transport: Transport, fetcher: AudioFetcher): Instance {
  return factories[node.type](node as any, transport, fetcher)
}
