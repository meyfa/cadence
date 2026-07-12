import type { GainMeterNode } from '@audiograph'
import type { UnsubscribeFn } from '@utility'
import type { Transport } from '../transport/transport.js'
import { createGainMeter } from '../worklets/metering/factory.js'
import type { Assets, MeterCallbacks } from './factory.js'
import type { Instance } from './instance.js'

export async function createGainMeterInstance (
  node: GainMeterNode,
  transport: Transport,
  assets: Assets,
  meterCallbacks?: MeterCallbacks
): Promise<Instance> {
  const instance = await createGainMeter(transport.ctx, {
    interval: node.interval * transport.ctx.sampleRate
  })

  let unsubscribe: UnsubscribeFn | undefined
  if (meterCallbacks != null) {
    unsubscribe = instance.measurements.subscribe((measurement) => {
      if (measurement != null) {
        meterCallbacks.onGain(node.key, measurement)
      }
    })
  }

  return {
    input: instance.node,
    output: instance.node,
    dispose: () => {
      unsubscribe?.()
      instance.dispose()
    }
  }
}
