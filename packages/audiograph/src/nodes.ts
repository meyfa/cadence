import type { Numeric } from '@core/numeric.js'
import type { Pitch } from '@core/program.js'
import type { Node } from './graph.js'
import type { TimeVariant } from './timevariant.js'

export interface IdentityNode extends Node {
  readonly type: 'identity'
}

export interface GainNode extends Node {
  readonly type: 'gain'
  readonly gain: TimeVariant<undefined>
}

export interface PanNode extends Node {
  readonly type: 'pan'
  readonly pan: Numeric<undefined>
}

export interface LowpassNode extends Node {
  readonly type: 'lowpass'
  readonly frequency: Numeric<'hz'>
}

export interface HighpassNode extends Node {
  readonly type: 'highpass'
  readonly frequency: Numeric<'hz'>
}

export interface DelayNode extends Node {
  readonly type: 'delay'
  readonly time: Numeric<'s'>
}

export interface ReverbNode extends Node {
  readonly type: 'reverb'
  readonly decay: Numeric<'s'>
}

export interface SampleNode extends Node {
  readonly type: 'sample'
  readonly sampleUrl: string
  readonly rootNote: Pitch
  readonly length?: Numeric<'s'>
}
