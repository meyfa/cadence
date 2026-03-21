import { NodeId, type AudioGraph } from '@audiograph/graph.js'
import type { Node } from '@audiograph/nodes.js'
import type { AudioFetcher } from '../assets/fetcher.js'
import type { Transport } from '../transport.js'
import { createNodeInstance } from './factory.js'
import type { Instance } from './instance.js'

export interface WebAudioGraph {
  /**
   * Resolves once all instances have finished their load attempts.
   * Rejects if any instance fails to load or the timeout is reached.
   */
  readonly loaded: Promise<void>

  readonly dispose: () => void
  readonly disposed: boolean
}

export function createWebAudioGraph (graph: AudioGraph<Node>, transport: Transport, fetcher: AudioFetcher): WebAudioGraph {
  const instances = createInstances(graph, transport, fetcher)

  setupRoutings(graph, instances, transport.output)
  scheduleNoteEvents(graph, instances)

  const loaded = Promise.all(
    Array.from(instances.values(), async (item) => await item.loaded)
  ).then(() => undefined)

  let disposed = false

  return {
    loaded,

    get disposed () {
      return disposed
    },

    dispose: () => {
      disposed = true
      for (const item of instances.values()) {
        item.dispose()
      }
    }
  }
}

function createInstances (graph: AudioGraph<Node>, transport: Transport, fetcher: AudioFetcher): Map<NodeId, Instance> {
  const instances = new Map<NodeId, Instance>()

  for (const node of graph.nodes.values()) {
    instances.set(node.id, createNodeInstance(node, transport, fetcher))
  }

  return instances
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
      instance?.triggerNote?.(event)
    }
  }
}
