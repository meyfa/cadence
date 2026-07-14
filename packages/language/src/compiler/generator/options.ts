import type { Numeric } from '@meyfa/cadence-utility'

export interface GenerateOptions {
  readonly beatsPerBar: number

  readonly tempo: {
    readonly default: Numeric<'bpm'>
    readonly minimum: Numeric<'bpm'>
    readonly maximum: Numeric<'bpm'>
  }
}
