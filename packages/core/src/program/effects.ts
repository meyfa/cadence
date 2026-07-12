import type { RuntimeNumeric } from '@utility'
import type { Parameter } from './automations.js'

export type Effect =
  GainEffect |
  PanEffect |
  LowpassEffect |
  HighpassEffect |
  WidthEffect |
  DelayEffect |
  ReverbEffect |
  ClipEffect

export interface GainEffect {
  readonly type: 'gain'
  readonly gain: Parameter<'db'>
}

export interface PanEffect {
  readonly type: 'pan'
  readonly pan: Parameter<undefined>
}

export interface LowpassEffect {
  readonly type: 'lowpass'
  readonly frequency: Parameter<'hz'>
}

export interface HighpassEffect {
  readonly type: 'highpass'
  readonly frequency: Parameter<'hz'>
}

export interface WidthEffect {
  readonly type: 'width'
  readonly width: RuntimeNumeric<undefined>
}

export interface DelayEffect {
  readonly type: 'delay'
  readonly mix: RuntimeNumeric<undefined>
  readonly time: RuntimeNumeric<'beats'> | RuntimeNumeric<'s'>
  readonly feedback: Parameter<undefined>
  readonly wet: RuntimeNumeric<'db'>
}

export interface ReverbEffect {
  readonly type: 'reverb'
  readonly mix: RuntimeNumeric<undefined>
  readonly decay: RuntimeNumeric<'beats'> | RuntimeNumeric<'s'>
  readonly wet: RuntimeNumeric<'db'>
}

export interface ClipEffect {
  readonly type: 'clip'
  readonly threshold: Parameter<'db'>
}
