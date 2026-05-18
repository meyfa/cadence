import { MutableObservable, numeric } from '@utility'
import { addWorkletModule } from '../worklets/loader.js'
import type { TimeTracker, TimeTrackerOptions } from './common.js'

const PROCESSOR_NAME = 'cadence-time-tracker'
const PROCESSOR_MODULE_URL = new URL('./time-tracker.worklet.js', import.meta.url)

export async function createWorkletTimeTracker (
  ctx: BaseAudioContext,
  connectTo: AudioNode,
  options: TimeTrackerOptions
): Promise<TimeTracker> {
  const { updateInterval, offsetTime } = options

  const time = new MutableObservable(numeric('s', 0))

  await addWorkletModule(ctx, PROCESSOR_MODULE_URL.href)

  const node = new AudioWorkletNode(ctx, PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [1]
  })

  let disposed = false

  const postIntervalFrames = Math.max(1, Math.round(updateInterval.value * ctx.sampleRate))
  node.port.postMessage({ type: 'init', postIntervalFrames })

  node.port.onmessage = (event: MessageEvent<unknown>) => {
    if (disposed || event.data == null || typeof event.data !== 'object' || !('type' in event.data) || typeof event.data.type !== 'string') {
      return
    }

    if (event.data.type === 'time') {
      const { currentTime } = event.data as unknown as { currentTime: number }
      time.set(numeric('s', currentTime - offsetTime.value))
    }
  }

  node.connect(connectTo)

  const dispose = () => {
    if (disposed) {
      return
    }

    disposed = true

    node.port.onmessage = null
    node.disconnect()
  }

  return { time, dispose }
}
