import type { Numeric } from '@meyfa/cadence-utility'
import { MutableObservable } from '@meyfa/cadence-utility'
import { createTimeMeter } from '../worklets/metering/factory.ts'
import type { TimeTracker, TimeTrackerOptions } from './common.ts'

export async function createWorkletTimeTracker (
  ctx: BaseAudioContext,
  input: AudioNode,
  options: TimeTrackerOptions
): Promise<TimeTracker> {
  const { updateInterval, offsetTime } = options

  const interval = Math.max(1, Math.floor(updateInterval * ctx.sampleRate))
  const instance = await createTimeMeter(ctx, { interval })

  input.connect(instance.node)

  const time = new MutableObservable(0 as Numeric<'s'>)
  const unsubscribe = instance.measurements.subscribe((measurement) => {
    if (measurement != null) {
      time.set((measurement.time - offsetTime) as Numeric<'s'>)
    }
  })

  const dispose = () => {
    unsubscribe()
    input.disconnect(instance.node)
    instance.dispose()
  }

  return { time, dispose }
}
