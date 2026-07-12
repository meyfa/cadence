import type { AssetId, Curve, NoteData } from '@core'
import type { RuntimeNumeric } from '@utility'
import type { EntityKey } from './entities.js'
import type { AnyNode } from './graph.js'

export interface NodeTypeMap {
  // utility
  readonly identity: IdentityNode

  // effects
  readonly gain: GainNode
  readonly pan: PanNode
  readonly biquad: BiquadNode
  readonly width: WidthNode
  readonly delay: DelayNode
  readonly reverb: ReverbNode
  readonly wave_shaper: WaveShaperNode

  // instrument
  readonly instrument: InstrumentNode

  // sources
  readonly sample: SampleNode
  readonly oscillator: OscillatorNode

  // metering
  readonly gain_meter: GainMeterNode
}

export type Node = NodeTypeMap[keyof NodeTypeMap]

// utility

export interface IdentityNode extends AnyNode {
  readonly type: 'identity'
}

// effects

export interface GainNode extends AnyNode {
  readonly type: 'gain'
  readonly gain: Curve<'s', undefined>
}

export interface PanNode extends AnyNode {
  readonly type: 'pan'
  readonly pan: Curve<'s', undefined>
}

export interface BiquadNode extends AnyNode {
  readonly type: 'biquad'
  readonly filterType: 'lowpass' | 'highpass'
  readonly frequency: Curve<'s', 'hz'>
  readonly rolloffPerOctave: RuntimeNumeric<'db'>
}

export interface WidthNode extends AnyNode {
  readonly type: 'width'
  readonly width: RuntimeNumeric<undefined>
}

export interface DelayNode extends AnyNode {
  readonly type: 'delay'
  readonly time: RuntimeNumeric<'s'>
}

export interface ReverbNode extends AnyNode {
  readonly type: 'reverb'
  readonly decay: RuntimeNumeric<'s'>
}

export interface WaveShaperNode extends AnyNode {
  readonly type: 'wave_shaper'
  readonly curve: Float32Array<ArrayBuffer>
}

// instrument

export interface InstrumentNode extends AnyNode {
  readonly type: 'instrument'
  readonly trigger: (note: NoteData) => readonly SourceNode[]
}

// sources

export type SourceNode = SampleNode | OscillatorNode

export interface SampleNode extends AnyNode {
  readonly type: 'sample'
  readonly gainCurve: Curve<'s', undefined>
  readonly duration?: RuntimeNumeric<'s'>
  readonly assetId: AssetId
  readonly playbackRate: RuntimeNumeric<undefined>
}

export interface OscillatorNode extends AnyNode {
  readonly type: 'oscillator'
  readonly gainCurve: Curve<'s', undefined>
  readonly duration: RuntimeNumeric<'s'> | undefined
  readonly shape: 'sine' | 'square' | 'saw' | 'triangle'
  readonly frequency: RuntimeNumeric<'hz'>
}

// metering

export interface GainMeterNode extends AnyNode {
  readonly type: 'gain_meter'

  /**
   * The entity for which this gain meter is measuring the gain.
   */
  readonly key: EntityKey

  /**
   * The approximate interval, in seconds, at which the gain meter should post updates.
   */
  readonly interval: RuntimeNumeric<'s'>
}
