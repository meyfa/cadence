import type { GainMeterNode } from '@meyfa/cadence-audiograph'
import type { UnsubscribeFn } from '@meyfa/cadence-utility'
import type { Transport } from '../transport/transport.ts'
import { createGainMeter } from '../worklets/metering/factory.ts'
import type { Assets, MeterCallbacks } from './factory.ts'
import type { Instance } from './instance.ts'

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
