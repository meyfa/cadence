import type { AudioGraph, Node, NodeId } from '@audiograph'
import type { AudioFetcher } from '../assets/fetcher.js'
import type { Transport } from '../transport/transport.js'
import type { MeterCallbacks } from './factory.js'
import { createNodeInstance } from './factory.js'
import type { Instance } from './instance.js'

export interface WebAudioGraph {
  readonly dispose: () => void
}

export async function createWebAudioGraph (
  graph: AudioGraph<Node>,
  transport: Transport,
  fetcher: AudioFetcher,
  meterCallbacks?: MeterCallbacks
): Promise<WebAudioGraph> {
  let disposed = false

  const assets = {
    samples: new Map()
  }

  const assetPromisesByUrl = new Map<string, Promise<AudioBuffer>>()

  for (const asset of graph.assets.values()) {
    const promise = assetPromisesByUrl.get(asset.url)

    if (promise == null) {
      assetPromisesByUrl.set(asset.url, fetcher.fetch(transport.ctx, asset.url).then((buffer) => {
        assets.samples.set(asset.id, buffer)
        return buffer
      }))
      continue
    }

    assetPromisesByUrl.set(asset.url, promise.then((buffer) => {
      assets.samples.set(asset.id, buffer)
      return buffer
    }))
  }

  try {
    await Promise.all(assetPromisesByUrl.values())
  } catch (err: unknown) {
    disposed = true
    throw err
  }

  const instances = new Map<NodeId, Instance>()
  const instancePromises = new Map<NodeId, Promise<void>>()

  for (const [nodeId, node] of graph.nodes) {
    const promise = Promise.resolve().then(() => {
      return createNodeInstance(node, transport, assets, meterCallbacks)
    }).then((instance) => {
      if (disposed) {
        instance.dispose()
        return
      }

      instances.set(nodeId, instance)
    })

    instancePromises.set(nodeId, promise)
  }

  try {
    await Promise.all(instancePromises.values())
  } catch (err: unknown) {
    disposed = true
    instances.forEach((instance) => instance.dispose())
    throw err
  }

  setupRoutings(graph, instances, transport.input)
  scheduleNoteEvents(graph, instances)

  return {
    dispose: () => {
      instances.forEach((instance) => instance.dispose())
    }
  }
}

function setupRoutings (graph: AudioGraph<Node>, instances: Map<NodeId, Instance>, output: AudioNode): void {
  for (const edge of graph.edges) {
    const from = instances.get(edge.from)
    const to = instances.get(edge.to)
    if (from?.output != null && to?.input != null) {
      from.output.connect(to.input)
    }
  }

  for (const outputId of graph.outputIds) {
    const from = instances.get(outputId)
    if (from?.output != null) {
      from.output.connect(output)
    }
  }
}

function scheduleNoteEvents (graph: AudioGraph<Node>, instances: Map<NodeId, Instance>): void {
  for (const [nodeId, options] of graph.noteEvents) {
    const instance = instances.get(nodeId)
    for (const event of options) {
      instance?.triggerNote?.(event, graph.tempo.value)
    }
  }
}
