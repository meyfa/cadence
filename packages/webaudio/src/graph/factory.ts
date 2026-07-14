import type { Node } from '@meyfa/cadence-audiograph'
import type { AssetId } from '@meyfa/cadence-core'
import type { Transport } from '../transport/transport.ts'
import type { GainMeasurement } from '../worklets/metering/messages.ts'
import { createBiquadInstance, createDelayInstance, createGainInstance, createIdentityInstance, createPanInstance, createReverbInstance, createWaveShaperInstance, createWidthInstance } from './effect.ts'
import { createInstrumentInstance } from './instruments/instrument.ts'
import { createOscillatorInstance } from './instruments/oscillator.ts'
import { createSampleInstance } from './instruments/sample.ts'
import { createGainMeterInstance } from './metering.ts'

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

  // instrument
  instrument: createInstrumentInstance,

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

type NodeFactoryReturnType<T extends Node> = ReturnType<typeof factories[T['type']]>

export interface Assets {
  readonly samples: ReadonlyMap<AssetId, AudioBuffer>
}

export interface MeterCallbacks {
  readonly onGain: (key: string, measurement: GainMeasurement) => void
}

export function createNodeInstance<T extends Node> (node: T, ...args: NodeFactoryArguments): NodeFactoryReturnType<T> {
  return factories[node.type](node as any, ...args) as NodeFactoryReturnType<T>
}
