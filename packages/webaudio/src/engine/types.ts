import type { Numeric } from '@utility'

export interface BeatRange {
  readonly start: Numeric<'beats'>
  readonly end?: Numeric<'beats'>
}
