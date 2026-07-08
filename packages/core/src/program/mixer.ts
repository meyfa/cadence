import type { Brand } from '@utility'
import type { Parameter } from './automations.js'
import type { Effect } from './effects.js'
import type { InstrumentId } from './instruments.js'

export interface Mixer {
  readonly buses: readonly Bus[]
  readonly routings: readonly MixerRouting[]
}

export type BusId = Brand<number, 'core.BusId'>

export interface Bus {
  readonly id: BusId
  readonly name: string
  readonly pan: Parameter<undefined>
  readonly gain: Parameter<'db'>
  readonly effects: readonly Effect[]
}

export interface MixerRouting {
  readonly implicit: boolean

  readonly source: {
    readonly type: 'instrument'
    readonly id: InstrumentId
  } | {
    readonly type: 'bus'
    readonly id: BusId
  }

  readonly destination: {
    readonly type: 'output'
  } | {
    readonly type: 'bus'
    readonly id: BusId
  }
}
