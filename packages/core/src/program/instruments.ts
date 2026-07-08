import type { Brand, Numeric } from '@utility'
import type { NoteData } from '../pattern/types.js'
import type { AssetId } from './assets.js'
import type { Parameter } from './automations.js'

export type InstrumentId = Brand<number, 'core.InstrumentId'>

export interface Instrument {
  readonly id: InstrumentId
  readonly gain: Parameter<'db'>
  readonly trigger: (note: NoteData) => readonly Voice[]
}

export interface Voice {
  readonly source: Source
  readonly envelope: Envelope
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

export interface Envelope {
  readonly attack: Numeric<'s'>
  readonly decay: Numeric<'s'>
  readonly sustain: Numeric<undefined>
  readonly release: Numeric<'s'>
}
