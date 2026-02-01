export interface Transport {
  readonly ctx: BaseAudioContext
  readonly output: GainNode

  readonly now: () => number

  readonly start: (position: number) => Promise<void>
  readonly dispose: () => Promise<void>

  readonly schedule: (time: number, callback: (time: number) => void) => void
}

interface ScheduledEvent {
  readonly time: number
  readonly callback: (time: number) => void
}

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

  const scheduled: ScheduledEvent[] = []

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

      scheduled.sort((a, b) => a.time - b.time)

      for (const event of scheduled) {
        event.callback(event.time + offsetTime)
      }

      scheduled.splice(0, scheduled.length)
    },

    dispose: async () => {
      output.disconnect()
      await ctx.close()
    },

    schedule: (time, callback) => {
      if (started) {
        callback(time + offsetTime)
        return
      }

      scheduled.push({ time, callback })
    }
  }
}
