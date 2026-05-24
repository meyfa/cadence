import type { Node } from '@audiograph'
import type { AudioFetcher } from '../assets/fetcher.js'
import type { Transport } from '../transport/transport.js'
import { createBiquadInstance, createDelayInstance, createGainInstance, createIdentityInstance, createPanInstance, createReverbInstance, createWidthInstance } from './effect.js'
import type { Instance } from './instance.js'
import { createGainMeterInstance } from './metering.js'
import { createSampleInstance } from './sample.js'

const factories = Object.freeze({
  identity: createIdentityInstance,

  // effects
  gain: createGainInstance,
  pan: createPanInstance,
  biquad: createBiquadInstance,
  width: createWidthInstance,
  delay: createDelayInstance,
  reverb: createReverbInstance,

  // sources
  sample: createSampleInstance,

  // metering
  gain_meter: createGainMeterInstance
})

export async function createNodeInstance (node: Node, transport: Transport, fetcher: AudioFetcher): Promise<Instance> {
  return factories[node.type](node as any, transport, fetcher)
}
