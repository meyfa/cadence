import type { Observable } from '@core/observable.js'
import type { Numeric } from '@core/program.js'

export interface TimeTrackerOptions {
  readonly updateInterval: Numeric<'s'>
  readonly offsetTime: Numeric<'s'>
}

export interface TimeTracker {
  readonly dispose: () => void
  readonly time: Observable<Numeric<'s'>>
}
