import type { Brand } from '@meyfa/cadence-utility'
import type { Parameter } from './automations.ts'
import type { Effect } from './effects.ts'
import type { InstrumentId } from './instruments.ts'

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
