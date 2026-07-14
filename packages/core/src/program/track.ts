import type { Numeric, Unit } from '@meyfa/cadence-utility'
import type { RelativeCurve } from '../curve/types.ts'
import type { Pattern } from '../pattern/types.ts'
import type { ParameterId } from './automations.ts'
import type { InstrumentId } from './instruments.ts'

export interface Track {
  readonly tempo: Numeric<'bpm'>
  readonly parts: readonly Part[]
}

export interface Part {
  readonly name?: string
  readonly length: Numeric<'beats'>
  readonly routings: readonly InstrumentRouting[]
  readonly automations: readonly Automation[]
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

export interface Automation {
  readonly parameterId: ParameterId
  readonly curve: RelativeCurve<Unit>
}
