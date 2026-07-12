import type { Numeric } from '@utility'
import { MutableObservable } from '@utility'
import type { TimeTracker, TimeTrackerOptions } from './common.js'

export function createIntervalTimeTracker (ctx: BaseAudioContext, options: TimeTrackerOptions): TimeTracker {
  const { updateInterval, offsetTime } = options

  const time = new MutableObservable(0 as Numeric<'s'>)

  const interval = setInterval(() => {
    time.set((ctx.currentTime - offsetTime) as Numeric<'s'>)
  }, updateInterval * 1000)

  const dispose = () => {
    clearInterval(interval)
  }

  return { time, dispose }
}
