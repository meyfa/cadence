import type { Numeric, Observable } from '@core'

export interface TimeTrackerOptions {
  readonly updateInterval: Numeric<'s'>
  readonly offsetTime: Numeric<'s'>
}

export interface TimeTracker {
  readonly dispose: () => void
  readonly time: Observable<Numeric<'s'>>
}
