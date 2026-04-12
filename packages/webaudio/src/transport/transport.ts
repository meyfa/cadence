import type { Numeric, Observable } from '@utility'
import { DisposeStack, MutableObservable, numeric } from '@utility'
import { createIntervalTimeTracker } from '../time-tracker/interval.js'
import { createWorkletTimeTracker } from '../time-tracker/worklet.js'
import { createImmediateScheduler, createRealtimeScheduler } from './scheduler.js'

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
  readonly start: (position: Numeric<'s'>) => Promise<void>
  readonly time: Observable<Numeric<'s'>>

  readonly dispose: () => void
}

export interface OfflineTransport extends Transport {
  readonly render: () => Promise<AudioBuffer>
  readonly time: Observable<Numeric<'s'> | undefined>
}

const TICK_INTERVAL = numeric('s', 0.025)
const SCHEDULE_AHEAD_TIME = numeric('s', 0.05)

// Assuming faster than real-time rendering, so less frequent updates should be sufficient for offline
const TIME_UPDATE_INTERVAL_ONLINE = numeric('s', 0.050)
const TIME_UPDATE_INTERVAL_OFFLINE = numeric('s', 0.100)

export function createOnlineTransport (): OnlineTransport {
  const disposeStack = new DisposeStack()

  const ctx = new AudioContext()
  disposeStack.push(() => void ctx.close())

  // Ensure consistent suspended state on creation
  if (ctx.state !== 'suspended') {
    void ctx.suspend()
  }

  const output = ctx.createGain()
  output.connect(ctx.destination)
  disposeStack.push(() => output.disconnect())

  let offsetTime = ctx.currentTime
  let started = false

  const time = new MutableObservable(numeric('s', 0))

  const scheduler = createRealtimeScheduler({
    now: () => ctx.currentTime,
    tickInterval: TICK_INTERVAL,
    scheduleAheadTime: SCHEDULE_AHEAD_TIME
  })
  disposeStack.push(() => scheduler.stop())

  const start: OnlineTransport['start'] = async (position) => {
    if (started) {
      return
    }

    started = true

    await ctx.resume()
    offsetTime = ctx.currentTime - position.value

    scheduler.start(offsetTime)

    const tracker = await (async () => {
      const options = {
        updateInterval: TIME_UPDATE_INTERVAL_ONLINE,
        offsetTime: numeric('s', offsetTime)
      }

      try {
        return await createWorkletTimeTracker(ctx, output, options)
      } catch {
        return createIntervalTimeTracker(ctx, options)
      }
    })()

    disposeStack.pushDisposable(tracker)
    disposeStack.push(tracker.time.subscribe((value) => time.set(value)))
  }

  const dispose: OnlineTransport['dispose'] = () => {
    disposeStack.dispose()
  }

  const schedule: OnlineTransport['schedule'] = (time, callback) => {
    scheduler.schedule(time, callback)
  }

  return { ctx, output, time, start, dispose, schedule }
}

export function createOfflineTransport (options: OfflineTransportOptions): OfflineTransport {
  const disposeStack = new DisposeStack()

  const ctx = new OfflineAudioContext({
    numberOfChannels: options.channels,
    // buffer must be non-zero length as required by the spec
    length: Math.max(1, Math.ceil(options.duration.value * options.sampleRate)),
    sampleRate: options.sampleRate
  })

  const output = ctx.createGain()
  output.connect(ctx.destination)
  disposeStack.push(() => output.disconnect())

  const time = new MutableObservable<Numeric<'s'> | undefined>(undefined)

  const scheduler = createImmediateScheduler()
  disposeStack.push(() => scheduler.stop())

  const render: OfflineTransport['render'] = async () => {
    scheduler.start(0)

    try {
      const tracker = await createWorkletTimeTracker(ctx, output, {
        updateInterval: TIME_UPDATE_INTERVAL_OFFLINE,
        offsetTime: numeric('s', 0)
      })

      disposeStack.pushDisposable(tracker)
      disposeStack.push(tracker.time.subscribe((value) => time.set(value)))
    } catch {
      // ignore (no timer-based fallback possible for offline context)
    }

    const buffer = await ctx.startRendering()

    disposeStack.dispose()

    return buffer
  }

  const schedule: Transport['schedule'] = (time, callback) => {
    scheduler.schedule(time, callback)
  }

  return { ctx, output, time, render, schedule }
}
