import type { Numeric } from '@meyfa/cadence-utility'

export interface BeatRange {
  readonly start: Numeric<'beats'>
  readonly end?: Numeric<'beats'>
}
