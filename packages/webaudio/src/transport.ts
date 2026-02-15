import type { Numeric } from '@core/program.js'
import { createScheduler } from './scheduler.js'

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
  readonly now: () => number

  readonly start: (position: number) => Promise<void>
  readonly dispose: () => void
}

export interface OfflineTransport extends Transport {
  readonly render: () => Promise<AudioBuffer>
}

const TICK_INTERVAL = 0.025
const SCHEDULE_AHEAD_TIME = 0.05

export function createOnlineTransport (): OnlineTransport {
  const ctx = new AudioContext()

  // Ensure consistent suspended state on creation
  if (ctx.state !== 'suspended') {
    void ctx.suspend()
  }

  const output = ctx.createGain()
  output.connect(ctx.destination)

  let offsetTime = ctx.currentTime
  let started = false

  const scheduler = createScheduler({
    now: () => ctx.currentTime,
    tickInterval: TICK_INTERVAL,
    scheduleAheadTime: SCHEDULE_AHEAD_TIME
  })

  return {
    ctx,
    output,

    now: () => ctx.currentTime - offsetTime,

    start: async (position) => {
      if (started) {
        return
      }

      started = true

      await ctx.resume()
      offsetTime = ctx.currentTime - position

      scheduler.start(offsetTime)
    },

    dispose: () => {
      scheduler.stop()
      output.disconnect()
      void ctx.close()
    },

    schedule: (time, callback) => {
      scheduler.schedule(time, callback)
    }
  }
}

export function createOfflineTransport (options: OfflineTransportOptions): OfflineTransport {
  const ctx = new OfflineAudioContext({
    numberOfChannels: options.channels,
    // buffer must be non-zero length as required by the spec
    length: Math.max(1, Math.ceil(options.duration.value * options.sampleRate)),
    sampleRate: options.sampleRate
  })

  const output = ctx.createGain()
  output.connect(ctx.destination)

  const callbacks: Array<{
    readonly time: number
    readonly callback: (time: number) => void
  }> = []

  return {
    ctx,
    output,

    render: async () => {
      callbacks.sort((a, b) => a.time - b.time)

      for (const { time, callback } of callbacks) {
        callback(time)
      }

      return await ctx.startRendering()
    },

    schedule: (time, callback) => {
      callbacks.push({ time, callback })
    }
  }
}
