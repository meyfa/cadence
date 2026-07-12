import type { RuntimeNumeric } from '@utility'
import type { Pattern } from '../pattern/types.js'
import type { InstrumentId } from './instruments.js'

export interface Track {
  readonly tempo: RuntimeNumeric<'bpm'>
  readonly parts: readonly Part[]
}

export interface Part {
  readonly name?: string
  readonly length: RuntimeNumeric<'beats'>
  readonly routings: readonly InstrumentRouting[]
}

export interface InstrumentRouting {
  readonly source: {
    readonly type: 'pattern'
    readonly value: Pattern
  }

  readonly destination: {
    readonly type: 'instrument'
    readonly id: InstrumentId
  }
}
