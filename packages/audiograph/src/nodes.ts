import type { Numeric } from '@core/numeric.js'
import type { Pitch } from '@core/program.js'
import type { TimeVariant } from './automation.js'
import type { AnyNode } from './graph.js'

export interface NodeTypeMap {
  readonly identity: IdentityNode
  readonly gain: GainNode
  readonly pan: PanNode
  readonly lowpass: LowpassNode
  readonly highpass: HighpassNode
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

export interface LowpassNode extends AnyNode {
  readonly type: 'lowpass'
  readonly frequency: Numeric<'hz'>
}

export interface HighpassNode extends AnyNode {
  readonly type: 'highpass'
  readonly frequency: Numeric<'hz'>
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
  readonly rootNote: Pitch
  readonly length?: Numeric<'s'>
}
