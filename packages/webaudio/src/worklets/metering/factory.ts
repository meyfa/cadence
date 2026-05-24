import type { Observable } from '@utility'
import { MutableObservable } from '@utility'
import { addWorkletModule } from '../loader.js'
import type { MeterConfiguration, TimeMeasurement } from './messages.js'

export interface MeterInstance<T> {
  readonly dispose: () => void
  readonly node: AudioWorkletNode
  readonly measurements: Observable<T | undefined>
}

export async function createMeter<T> (
  ctx: BaseAudioContext,
  url: URL,
  processor: string,
  configuration: MeterConfiguration
): Promise<MeterInstance<T | undefined>> {
  await addWorkletModule(ctx, url.href)

  const measurements = new MutableObservable<T | undefined>(undefined)

  const node = new AudioWorkletNode(ctx, processor, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1]
  })

  let disposed = false

  node.port.postMessage(configuration)

  node.port.onmessage = (event: MessageEvent<T>) => {
    if (!disposed) {
      measurements.set(event.data)
    }
  }

  const dispose = () => {
    if (!disposed) {
      disposed = true
      node.port.onmessage = null
      node.disconnect()
    }
  }

  return { dispose, node, measurements }
}

type MeterFactory<T> = (ctx: BaseAudioContext, configuration: MeterConfiguration) => Promise<MeterInstance<T | undefined>>

export const createTimeMeter: MeterFactory<TimeMeasurement> = async (ctx, configuration) => {
  const url = new URL('./time-meter.worklet.js', import.meta.url)
  return await createMeter(ctx, url, 'time_meter', configuration)
}
