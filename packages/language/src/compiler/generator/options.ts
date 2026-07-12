import type { Numeric } from '@utility'

export interface GenerateOptions {
  readonly beatsPerBar: number

  readonly tempo: {
    readonly default: Numeric<'bpm'>
    readonly minimum: Numeric<'bpm'>
    readonly maximum: Numeric<'bpm'>
  }
}
