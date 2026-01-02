import type { Numeric } from '@core/program.js'

export interface BeatRange {
  readonly start: Numeric<'beats'>
  readonly end?: Numeric<'beats'>
}
