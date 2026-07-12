import type { RuntimeNumeric, Observable } from '@utility'
import { DisposeStack, MutableObservable, runtimeNumeric } from '@utility'
import { createIntervalTimeTracker } from '../time-tracker/interval.js'
import { createWorkletTimeTracker } from '../time-tracker/worklet.js'
import { createImmediateScheduler, createRealtimeScheduler } from './scheduler.js'

export interface OfflineTransportOptions {
  readonly duration: RuntimeNumeric<'s'>
  readonly channels: number
  readonly sampleRate: number
}

export interface Transport {
  readonly ctx: BaseAudioContext
  readonly input: AudioNode
  readonly output: GainNode

  readonly schedule: (time: number, callback: (time: number) => void) => void
}

export interface OnlineTransport extends Transport {
  readonly start: (position: RuntimeNumeric<'s'>) => Promise<void>
  readonly time: Observable<RuntimeNumeric<'s'>>

  readonly dispose: () => void
}

export interface OfflineTransport extends Transport {
  readonly render: () => Promise<AudioBuffer>
  readonly time: Observable<RuntimeNumeric<'s'> | undefined>
}

const TICK_INTERVAL = runtimeNumeric('s', 0.025)
const SCHEDULE_AHEAD_TIME = runtimeNumeric('s', 0.05)

// Assuming faster than real-time rendering, so less frequent updates should be sufficient for offline
const TIME_UPDATE_INTERVAL_ONLINE = runtimeNumeric('s', 0.050)
const TIME_UPDATE_INTERVAL_OFFLINE = runtimeNumeric('s', 0.100)

export function createOnlineTransport (): OnlineTransport {
  const disposeStack = new DisposeStack()

  const ctx = new AudioContext()
  disposeStack.push(() => void ctx.close())

  // Ensure consistent suspended state on creation
  if (ctx.state !== 'suspended') {
    void ctx.suspend()
  }

  // Hard limit the output before applying output gain, as otherwise
  // users could apply positive gain to the input (producing a signal >1)
  // and therefore circumvent the output gain.
  const input = ctx.createWaveShaper()
  input.curve = new Float32Array([-1, 0, 1])
  disposeStack.push(() => input.disconnect())

  const output = ctx.createGain()
  input.connect(output)
  output.connect(ctx.destination)
  disposeStack.push(() => output.disconnect())

  let offsetTime = ctx.currentTime
  let started = false

  const time = new MutableObservable(runtimeNumeric('s', 0))

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
        offsetTime: runtimeNumeric('s', offsetTime)
      }

      try {
        return await createWorkletTimeTracker(ctx, input, options)
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

  return { ctx, input, output, time, start, dispose, schedule }
}

export function createOfflineTransport (options: OfflineTransportOptions): OfflineTransport {
  const disposeStack = new DisposeStack()

  const ctx = new OfflineAudioContext({
    numberOfChannels: options.channels,
    // buffer must be non-zero length as required by the spec
    length: Math.max(1, Math.ceil(options.duration.value * options.sampleRate)),
    sampleRate: options.sampleRate
  })

  const input = ctx.createGain()
  const output = input
  output.connect(ctx.destination)
  disposeStack.push(() => output.disconnect())

  const time = new MutableObservable<RuntimeNumeric<'s'> | undefined>(undefined)

  const scheduler = createImmediateScheduler()
  disposeStack.push(() => scheduler.stop())

  const render: OfflineTransport['render'] = async () => {
    scheduler.start(0)

    try {
      const tracker = await createWorkletTimeTracker(ctx, input, {
        updateInterval: TIME_UPDATE_INTERVAL_OFFLINE,
        offsetTime: runtimeNumeric('s', 0)
      })

      disposeStack.pushDisposable(tracker)
      disposeStack.push(tracker.time.subscribe((value) => time.set(value)))
    } catch {
      // ignore (no timer-based fallback possible for offline context)
    }

    const buffer = await ctx.startRendering()

    // Offline rendering knows its exact end time even if the worklet meter's
    // final postMessage is delayed or never observed on the main thread.
    time.set(runtimeNumeric('s', buffer.length / buffer.sampleRate))

    disposeStack.dispose()

    return buffer
  }

  const schedule: Transport['schedule'] = (time, callback) => {
    scheduler.schedule(time, callback)
  }

  return { ctx, input, output, time, render, schedule }
}
