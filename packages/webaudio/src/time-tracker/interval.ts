import { MutableObservable, runtimeNumeric } from '@utility'
import type { TimeTracker, TimeTrackerOptions } from './common.js'

export function createIntervalTimeTracker (ctx: BaseAudioContext, options: TimeTrackerOptions): TimeTracker {
  const { updateInterval, offsetTime } = options

  const time = new MutableObservable(runtimeNumeric('s', 0))

  const interval = setInterval(() => {
    time.set(runtimeNumeric('s', ctx.currentTime - offsetTime.value))
  }, updateInterval.value * 1000)

  const dispose = () => {
    clearInterval(interval)
  }

  return { time, dispose }
}
