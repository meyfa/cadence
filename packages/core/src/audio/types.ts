import type { Numeric } from '@core/program.js'

export interface StepRange {
  readonly start: Numeric<'steps'>
  readonly end?: Numeric<'steps'>
}
