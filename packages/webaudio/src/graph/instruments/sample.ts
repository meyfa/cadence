import type { SampleNode } from '@audiograph'
import type { Transport } from '../../transport/transport.js'
import type { Assets } from '../factory.js'
import type { Instance } from '../instance.js'
import type { CreateSource } from './common.js'
import { createInstrumentInstance } from './common.js'

export async function createSampleInstance (node: SampleNode, transport: Transport, assets: Assets): Promise<Instance> {
  const { ctx } = transport

  const sampleBuffer = assets.samples.get(node.assetId)
  if (!sampleBuffer) {
    throw new Error(`Asset not found: ${node.assetId}`)
  }

  const createSource: CreateSource = (note) => {
    const sourceNode = ctx.createBufferSource()
    sourceNode.buffer = sampleBuffer
    sourceNode.playbackRate.value = Math.pow(2, ((note.pitch ?? node.rootNote) - node.rootNote) / 12)
    return sourceNode
  }

  return createInstrumentInstance(transport, createSource, {
    envelope: node.envelope,
    rootNote: node.rootNote,
    length: node.length
  })
}
