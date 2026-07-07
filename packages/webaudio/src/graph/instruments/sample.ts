import type { SampleNode } from '@audiograph'
import type { Transport } from '../../transport/transport.js'
import type { Assets } from '../factory.js'
import type { Instance } from '../instance.js'

export function createSampleInstance (node: SampleNode, transport: Transport, assets: Assets): Instance {
  const audioNode = createSampleSource(node, transport, assets)

  return {
    input: audioNode,
    output: audioNode,
    dispose: () => {
      audioNode.disconnect()
    }
  }
}

export function createSampleSource (
  node: SampleNode,
  transport: Transport,
  assets: Assets
): AudioScheduledSourceNode {
  const sampleBuffer = assets.samples.get(node.assetId)
  if (!sampleBuffer) {
    throw new Error(`Asset not found: ${node.assetId}`)
  }

  const sourceNode = transport.ctx.createBufferSource()
  sourceNode.buffer = sampleBuffer
  sourceNode.playbackRate.value = node.playbackRate.value

  return sourceNode
}
