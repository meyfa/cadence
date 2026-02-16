import { MutableObservable } from '@core/observable.js'
import { makeNumeric } from '@core/program.js'
import type { TimeTracker, TimeTrackerOptions } from './common.js'

export function createIntervalTimeTracker (ctx: BaseAudioContext, options: TimeTrackerOptions): TimeTracker {
  const { updateInterval, offsetTime } = options

  const time = new MutableObservable(makeNumeric('s', 0))

  const interval = setInterval(() => {
    time.set(makeNumeric('s', ctx.currentTime - offsetTime.value))
  }, updateInterval.value * 1000)

  const dispose = () => {
    clearInterval(interval)
  }

  return { time, dispose }
}
