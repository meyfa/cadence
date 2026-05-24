import type { GainMeterNode } from '@audiograph'
import type { Transport } from '../transport/transport.js'
import type { Instance } from './instance.js'
import { createGainMeter } from '../worklets/metering/factory.js'

export async function createGainMeterInstance (node: GainMeterNode, transport: Transport): Promise<Instance> {
  const instance = await createGainMeter(transport.ctx, {
    interval: node.interval.value * transport.ctx.sampleRate
  })

  return {
    input: instance.node,
    output: instance.node,
    dispose: () => {
      instance.dispose()
    }
  }
}
