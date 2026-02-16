import { MutableObservable, type Observable } from '@core/observable.js'
import { makeNumeric, type Numeric } from '@core/program.js'
import { createScheduler } from './scheduler.js'
import { createIntervalTimeTracker } from './time/interval.js'
import { createWorkletTimeTracker } from './time/worklet.js'

export interface OfflineTransportOptions {
  readonly duration: Numeric<'s'>
  readonly channels: number
  readonly sampleRate: number
}

export interface Transport {
  readonly ctx: BaseAudioContext
  readonly output: GainNode

  readonly schedule: (time: number, callback: (time: number) => void) => void
}

export interface OnlineTransport extends Transport {
  readonly start: (position: number) => Promise<void>
  readonly time: Observable<Numeric<'s'>>

  readonly dispose: () => void
}

export interface OfflineTransport extends Transport {
  readonly render: () => Promise<AudioBuffer>
  readonly time: Observable<Numeric<'s'> | undefined>
}

const TICK_INTERVAL = 0.025
const SCHEDULE_AHEAD_TIME = 0.05

export function createOnlineTransport (): OnlineTransport {
  const cleanupHooks: Array<() => void> = []

  const ctx = new AudioContext()
  cleanupHooks.push(() => void ctx.close())

  // Ensure consistent suspended state on creation
  if (ctx.state !== 'suspended') {
    void ctx.suspend()
  }

  const output = ctx.createGain()
  output.connect(ctx.destination)
  cleanupHooks.push(() => output.disconnect())

  let offsetTime = ctx.currentTime
  let started = false

  const time = new MutableObservable(makeNumeric('s', 0))

  const scheduler = createScheduler({
    now: () => ctx.currentTime,
    tickInterval: TICK_INTERVAL,
    scheduleAheadTime: SCHEDULE_AHEAD_TIME
  })
  cleanupHooks.push(() => scheduler.stop())

  const start = async (position: number) => {
    if (started) {
      return
    }

    started = true

    await ctx.resume()
    offsetTime = ctx.currentTime - position

    scheduler.start(offsetTime)

    const tracker = await (async () => {
      const options = {
        updateInterval: makeNumeric('s', TICK_INTERVAL),
        offsetTime: makeNumeric('s', offsetTime)
      }

      try {
        return await createWorkletTimeTracker(ctx, output, options)
      } catch {
        return createIntervalTimeTracker(ctx, options)
      }
    })()

    cleanupHooks.push(() => tracker.dispose())
    cleanupHooks.push(tracker.time.subscribe((value) => time.set(value)))
  }

  const dispose = () => {
    cleanupHooks.reverse()
    cleanupHooks.forEach((hook) => hook())
    cleanupHooks.splice(0, cleanupHooks.length)
  }

  const schedule: Transport['schedule'] = (time, callback) => {
    scheduler.schedule(time, callback)
  }

  return { ctx, output, time, start, dispose, schedule }
}

export function createOfflineTransport (options: OfflineTransportOptions): OfflineTransport {
  const cleanupHooks: Array<() => void> = []

  const ctx = new OfflineAudioContext({
    numberOfChannels: options.channels,
    // buffer must be non-zero length as required by the spec
    length: Math.max(1, Math.ceil(options.duration.value * options.sampleRate)),
    sampleRate: options.sampleRate
  })

  const output = ctx.createGain()
  output.connect(ctx.destination)

  const time = new MutableObservable<Numeric<'s'> | undefined>(undefined)

  const callbacks: Array<{
    readonly time: number
    readonly callback: (time: number) => void
  }> = []

  const render = async () => {
    callbacks.sort((a, b) => a.time - b.time)
    callbacks.forEach(({ time, callback }) => callback(time))
    callbacks.splice(0, callbacks.length)

    try {
      const tracker = await createWorkletTimeTracker(ctx, output, {
        updateInterval: makeNumeric('s', TICK_INTERVAL),
        offsetTime: makeNumeric('s', 0)
      })

      cleanupHooks.push(() => tracker.dispose())
      cleanupHooks.push(tracker.time.subscribe((value) => time.set(value)))
    } catch {
      // ignore (no timer-based fallback possible for offline context)
    }

    const buffer = await ctx.startRendering()

    cleanupHooks.reverse()
    cleanupHooks.forEach((hook) => hook())
    cleanupHooks.splice(0, cleanupHooks.length)

    return buffer
  }

  const schedule: Transport['schedule'] = (time, callback) => {
    callbacks.push({ time, callback })
  }

  return { ctx, output, time, render, schedule }
}
