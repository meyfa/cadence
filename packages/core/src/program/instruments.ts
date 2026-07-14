import type { Brand, Numeric } from '@meyfa/cadence-utility'
import type { Curve } from '../curve/types.ts'
import type { NoteData } from '../pattern/types.ts'
import type { AssetId } from './assets.ts'
import type { Parameter } from './automations.ts'

export type InstrumentId = Brand<number, 'core.InstrumentId'>

export interface Instrument {
  readonly id: InstrumentId
  readonly label?: string
  readonly gain: Parameter<'db'>
  readonly voices: readonly Voice[]
}

export interface Voice {
  readonly invoke: (note: NoteData, tempo: Numeric<'bpm'>) => VoiceInstance
}

export interface VoiceInstance<S extends Source = Source> {
  readonly source: S
  readonly envelope: Curve<'s', 'db'>
  readonly duration?: Numeric<'s'>
}

export type Source = Sample | Oscillator

export interface Sample {
  readonly type: 'sample'
  readonly assetId: AssetId
  readonly length?: Numeric<'s'>
  readonly playbackRate: Numeric<undefined>
}

export interface Oscillator {
  readonly type: 'oscillator'
  readonly shape: 'sine' | 'square' | 'saw' | 'triangle'
  readonly frequency: Numeric<'hz'>
}
