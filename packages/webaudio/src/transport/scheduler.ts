import { insertSorted, type Numeric } from '@utility'

export interface SchedulerOptions {
  /**
   * Time source for the scheduler (e.g. AudioContext.currentTime).
   */
  readonly now: () => number

  /**
   * Scheduler tick frequency.
   */
  readonly tickInterval: Numeric<'s'>

  /**
   * How far ahead (from transport time) callbacks may run.
   */
  readonly scheduleAheadTime: Numeric<'s'>

  readonly timers?: {
    readonly setInterval: typeof globalThis.setInterval
    readonly clearInterval: typeof globalThis.clearInterval
  }
}

export interface Scheduler {
  /**
   * Begin periodic flushing of events.
   *
   * @param offsetTime AudioContext time when transport time is 0.
   */
  readonly start: (offsetTime: number) => void

  /**
   * Stop periodic flushing of events.
   */
  readonly stop: () => void

  /**
   * Schedule a callback for a transport time.
   *
   * The callback receives an absolute AudioContext time.
   */
  readonly schedule: (time: number, callback: (time: number) => void) => void

  /**
   * Flush any currently-due events (useful after scheduling near-term events).
   */
  readonly flush: () => void
}

interface ScheduledEvent {
  readonly time: number
  readonly callback: (time: number) => void
}

const compareByTime = (a: ScheduledEvent, b: ScheduledEvent): number => a.time - b.time

export function createScheduler (options: SchedulerOptions): Scheduler {
  const { now, tickInterval, scheduleAheadTime } = options

  const timers = options.timers ?? {
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis)
  }

  const scheduled: ScheduledEvent[] = []
  let sorted = false

  let interval: ReturnType<typeof globalThis.setInterval> | undefined
  let offsetTime = 0
  let started = false

  const flush = () => {
    if (!started) {
      return
    }

    if (!sorted) {
      scheduled.sort(compareByTime)
      sorted = true
    }

    flushBefore(scheduled, now() - offsetTime + scheduleAheadTime.value, offsetTime)
  }

  const start = (newOffsetTime: number) => {
    if (started) {
      return
    }

    started = true
    offsetTime = newOffsetTime

    flush()
    interval = timers.setInterval(flush, tickInterval.value * 1000)
  }

  const stop = () => {
    if (interval != null) {
      timers.clearInterval(interval)
      interval = undefined
    }
  }

  const schedule = (time: number, callback: (time: number) => void) => {
    const event: ScheduledEvent = { time, callback }

    if (!started) {
      // Keep pre-start scheduling cheap: push and sort once on start.
      scheduled.push(event)
      sorted = false
      return
    }

    if (!sorted) {
      scheduled.push(event)
    } else {
      insertSorted(scheduled, event, compareByTime)
    }

    // If the event is near, try scheduling it without waiting for the next tick.
    if (time <= now() - offsetTime + scheduleAheadTime.value) {
      flush()
    }
  }

  return { start, stop, schedule, flush }
}

function flushBefore (array: ScheduledEvent[], threshold: number, offsetTime: number): void {
  let flushed = 0

  for (const event of array) {
    if (event.time > threshold) {
      break
    }

    event.callback(event.time + offsetTime)
    ++flushed
  }

  array.splice(0, flushed)
}
