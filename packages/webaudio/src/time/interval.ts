import { MutableObservable, numeric } from '@core'
import type { TimeTracker, TimeTrackerOptions } from './common.js'

export function createIntervalTimeTracker (ctx: BaseAudioContext, options: TimeTrackerOptions): TimeTracker {
  const { updateInterval, offsetTime } = options

  const time = new MutableObservable(numeric('s', 0))

  const interval = setInterval(() => {
    time.set(numeric('s', ctx.currentTime - offsetTime.value))
  }, updateInterval.value * 1000)

  const dispose = () => {
    clearInterval(interval)
  }

  return { time, dispose }
}
