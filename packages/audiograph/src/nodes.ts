import type { MidiNote } from '@core/midi.js'
import type { Numeric } from '@core/numeric.js'
import type { TimeVariant } from './automation.js'
import type { AnyNode } from './graph.js'

export interface NodeTypeMap {
  readonly identity: IdentityNode
  readonly gain: GainNode
  readonly pan: PanNode
  readonly biquad: BiquadNode
  readonly delay: DelayNode
  readonly reverb: ReverbNode
  readonly sample: SampleNode
}

export type Node = NodeTypeMap[keyof NodeTypeMap]

export interface IdentityNode extends AnyNode {
  readonly type: 'identity'
}

export interface GainNode extends AnyNode {
  readonly type: 'gain'
  readonly gain: TimeVariant<undefined>
}

export interface PanNode extends AnyNode {
  readonly type: 'pan'
  readonly pan: Numeric<undefined>
}

export interface BiquadNode extends AnyNode {
  readonly type: 'biquad'
  readonly filterType: 'lowpass' | 'highpass'
  readonly frequency: Numeric<'hz'>
  readonly rolloffPerOctave: Numeric<'db'>
}

export interface DelayNode extends AnyNode {
  readonly type: 'delay'
  readonly time: Numeric<'s'>
}

export interface ReverbNode extends AnyNode {
  readonly type: 'reverb'
  readonly decay: Numeric<'s'>
}

export interface SampleNode extends AnyNode {
  readonly type: 'sample'
  readonly sampleUrl: string
  readonly rootNote: MidiNote
  readonly length?: Numeric<'s'>
}
