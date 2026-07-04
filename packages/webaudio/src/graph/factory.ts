import type { Node } from '@audiograph'
import type { Transport } from '../transport/transport.js'
import type { GainMeasurement } from '../worklets/metering/messages.js'
import { createBiquadInstance, createDelayInstance, createGainInstance, createIdentityInstance, createPanInstance, createReverbInstance, createWaveShaperInstance, createWidthInstance } from './effect.js'
import type { Instance } from './instance.js'
import { createOscillatorInstance } from './instruments/oscillator.js'
import { createSampleInstance } from './instruments/sample.js'
import { createGainMeterInstance } from './metering.js'
import type { AssetId } from '@core'

const factories = Object.freeze({
  identity: createIdentityInstance,

  // effects
  gain: createGainInstance,
  pan: createPanInstance,
  biquad: createBiquadInstance,
  width: createWidthInstance,
  delay: createDelayInstance,
  reverb: createReverbInstance,
  wave_shaper: createWaveShaperInstance,

  // sources
  sample: createSampleInstance,
  oscillator: createOscillatorInstance,

  // metering
  gain_meter: createGainMeterInstance
})

type NodeFactoryArguments = readonly [
  transport: Transport,
  assets: Assets,
  meterCallbacks?: MeterCallbacks
]

export interface Assets {
  readonly samples: ReadonlyMap<AssetId, AudioBuffer>
}

export interface MeterCallbacks {
  readonly onGain: (key: string, measurement: GainMeasurement) => void
}

export async function createNodeInstance (node: Node, ...args: NodeFactoryArguments): Promise<Instance> {
  return factories[node.type](node as any, ...args)
}
