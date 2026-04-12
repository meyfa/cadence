import type { Numeric } from '@utility'
import { insertSorted } from '@utility'

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

export interface RealtimeSchedulerOptions {
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

export function createRealtimeScheduler (options: RealtimeSchedulerOptions): Scheduler {
  const { now, tickInterval, scheduleAheadTime } = options

  const timers = options.timers ?? {
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis)
  }

  const queue = createScheduledEventQueue()

  let interval: ReturnType<typeof globalThis.setInterval> | undefined
  let offsetTime = 0
  let started = false

  const flush = () => {
    if (started) {
      queue.flushBefore(now() - offsetTime + scheduleAheadTime.value, offsetTime)
    }
  }

  const start = (newOffsetTime: number) => {
    if (!started) {
      started = true
      offsetTime = newOffsetTime
      flush()
      interval = timers.setInterval(flush, tickInterval.value * 1000)
    }
  }

  const stop = () => {
    if (interval != null) {
      timers.clearInterval(interval)
      interval = undefined
    }

    started = false
  }

  const schedule = (time: number, callback: (time: number) => void) => {
    queue.schedule({ time, callback })
    // If the event is near, try scheduling it without waiting for the next tick.
    if (started && time <= now() - offsetTime + scheduleAheadTime.value) {
      flush()
    }
  }

  return { start, stop, schedule, flush }
}

export function createImmediateScheduler (): Scheduler {
  const queue = createScheduledEventQueue()

  let offsetTime = 0
  let started = false

  const flush = () => {
    if (started) {
      queue.flushAll(offsetTime)
    }
  }

  const start = (newOffsetTime: number) => {
    if (!started) {
      started = true
      offsetTime = newOffsetTime
      flush()
    }
  }

  const stop = () => {
    started = false
  }

  const schedule = (time: number, callback: (time: number) => void) => {
    queue.schedule({ time, callback })
    if (started) {
      flush()
    }
  }

  return { start, stop, schedule, flush }
}

interface ScheduledEventQueue {
  readonly schedule: (event: ScheduledEvent) => void
  readonly flushAll: (offsetTime: number) => void
  readonly flushBefore: (threshold: number, offsetTime: number) => void
}

interface ScheduledEvent {
  readonly time: number
  readonly callback: (time: number) => void
}

const compareByTime = (a: ScheduledEvent, b: ScheduledEvent): number => a.time - b.time

function createScheduledEventQueue (): ScheduledEventQueue {
  const scheduled: ScheduledEvent[] = []
  let sorted = false

  const ensureSorted = () => {
    if (!sorted) {
      scheduled.sort(compareByTime)
      sorted = true
    }
  }

  const schedule: ScheduledEventQueue['schedule'] = (event) => {
    if (!sorted) {
      scheduled.push(event)
      return
    }

    insertSorted(scheduled, event, compareByTime)
  }

  const flushAll: ScheduledEventQueue['flushAll'] = (offsetTime) => {
    ensureSorted()

    for (const event of scheduled) {
      event.callback(event.time + offsetTime)
    }

    scheduled.splice(0, scheduled.length)
  }

  const flushBefore: ScheduledEventQueue['flushBefore'] = (threshold, offsetTime) => {
    ensureSorted()

    let flushed = 0

    for (const event of scheduled) {
      if (event.time > threshold) {
        break
      }

      event.callback(event.time + offsetTime)
      ++flushed
    }

    scheduled.splice(0, flushed)
  }

  return { schedule, flushAll, flushBefore }
}
