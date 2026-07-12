import type { Brand, RuntimeNumeric } from '@utility'
import type { Curve } from '../curve/types.js'
import type { NoteData } from '../pattern/types.js'
import type { AssetId } from './assets.js'
import type { Parameter } from './automations.js'

export type InstrumentId = Brand<number, 'core.InstrumentId'>

export interface Instrument {
  readonly id: InstrumentId
  readonly gain: Parameter<'db'>
  readonly trigger: (note: NoteData, tempo: RuntimeNumeric<'bpm'>) => readonly Voice[]
}

export interface Voice<S extends Source = Source> {
  readonly source: S
  readonly envelope: Curve<'s', 'db'>
  readonly duration?: RuntimeNumeric<'s'>
}

export type Source = Sample | Oscillator

export interface Sample {
  readonly type: 'sample'
  readonly assetId: AssetId
  readonly length?: RuntimeNumeric<'s'>
  readonly playbackRate: RuntimeNumeric<undefined>
}

export interface Oscillator {
  readonly type: 'oscillator'
  readonly shape: 'sine' | 'square' | 'saw' | 'triangle'
  readonly frequency: RuntimeNumeric<'hz'>
}
