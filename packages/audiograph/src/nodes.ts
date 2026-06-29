import type { MidiNote } from '@core'
import type { Numeric } from '@utility'
import type { TimeVariant } from './automation.js'
import type { EntityKey } from './entities.js'
import type { AnyNode, NoteOptions } from './graph.js'

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
  readonly gain: TimeVariant<undefined>
}

export interface PanNode extends AnyNode {
  readonly type: 'pan'
  readonly pan: TimeVariant<undefined>
}

export interface BiquadNode extends AnyNode {
  readonly type: 'biquad'
  readonly filterType: 'lowpass' | 'highpass'
  readonly frequency: TimeVariant<'hz'>
  readonly rolloffPerOctave: Numeric<'db'>
}

export interface WidthNode extends AnyNode {
  readonly type: 'width'
  readonly width: Numeric<undefined>
}

export interface DelayNode extends AnyNode {
  readonly type: 'delay'
  readonly time: Numeric<'s'>
}

export interface ReverbNode extends AnyNode {
  readonly type: 'reverb'
  readonly decay: Numeric<'s'>
}

export interface WaveShaperNode extends AnyNode {
  readonly type: 'wave_shaper'
  readonly curve: Float32Array<ArrayBuffer>
}

// sources

export interface SampleNode extends AnyNode {
  readonly type: 'sample'
  readonly rootNote: MidiNote
  readonly envelope: (note: Pick<NoteOptions, 'duration' | 'velocity'>) => TimeVariant<undefined>
  readonly url: string
  readonly length?: Numeric<'s'>
}

export interface OscillatorNode extends AnyNode {
  readonly type: 'oscillator'
  readonly rootNote: MidiNote
  readonly envelope: (note: Pick<NoteOptions, 'duration' | 'velocity'>) => TimeVariant<undefined>
  readonly shape: 'sine' | 'square' | 'saw' | 'triangle'
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
  readonly interval: Numeric<'s'>
}
