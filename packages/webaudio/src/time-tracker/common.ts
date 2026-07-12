import type { RuntimeNumeric, Observable } from '@utility'

export interface TimeTrackerOptions {
  readonly updateInterval: RuntimeNumeric<'s'>
  readonly offsetTime: RuntimeNumeric<'s'>
}

export interface TimeTracker {
  readonly dispose: () => void
  readonly time: Observable<RuntimeNumeric<'s'>>
}
