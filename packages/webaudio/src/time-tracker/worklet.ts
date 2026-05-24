import { MutableObservable, numeric } from '@utility'
import { createTimeMeter } from '../worklets/metering/factory.js'
import type { TimeTracker, TimeTrackerOptions } from './common.js'

export async function createWorkletTimeTracker (
  ctx: BaseAudioContext,
  input: AudioNode,
  options: TimeTrackerOptions
): Promise<TimeTracker> {
  const { updateInterval, offsetTime } = options

  const interval = Math.max(1, Math.floor(updateInterval.value * ctx.sampleRate))
  const instance = await createTimeMeter(ctx, { interval })

  input.connect(instance.node)

  const time = new MutableObservable(numeric('s', 0))
  const unsubscribe = instance.measurements.subscribe((measurement) => {
    if (measurement != null) {
      time.set(numeric('s', measurement.time - offsetTime.value))
    }
  })

  const dispose = () => {
    unsubscribe()
    input.disconnect(instance.node)
    instance.dispose()
  }

  return { time, dispose }
}
