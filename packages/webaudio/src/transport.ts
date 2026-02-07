import { createScheduler } from './scheduler.js'

export interface Transport {
  readonly ctx: BaseAudioContext
  readonly output: GainNode

  readonly now: () => number

  readonly start: (position: number) => Promise<void>
  readonly dispose: () => Promise<void>

  readonly schedule: (time: number, callback: (time: number) => void) => void
}

const TICK_INTERVAL = 0.025
const SCHEDULE_AHEAD_TIME = 0.05

export function createTransport (): Transport {
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

    dispose: async () => {
      scheduler.stop()
      output.disconnect()
      await ctx.close()
    },

    schedule: (time, callback) => {
      scheduler.schedule(time, callback)
    }
  }
}
