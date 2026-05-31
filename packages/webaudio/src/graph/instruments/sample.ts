import type { SampleNode } from '@audiograph'
import type { AudioFetcher } from '../../assets/fetcher.js'
import type { Transport } from '../../transport/transport.js'
import type { Instance } from '../instance.js'
import type { CreateSource } from './common.js'
import { createInstrumentInstance } from './common.js'

export async function createSampleInstance (node: SampleNode, transport: Transport, fetcher: AudioFetcher): Promise<Instance> {
  const { ctx } = transport

  const sampleBuffer = await fetcher.fetch(ctx, node.url)

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
