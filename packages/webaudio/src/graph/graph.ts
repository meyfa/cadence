import { NodeId, type AudioGraph } from '@audiograph/graph.js'
import type { Node } from '@audiograph/nodes.js'
import type { Program } from '@core/program.js'
import type { AudioFetcher } from '../assets/fetcher.js'
import type { Transport } from '../transport.js'
import { createEffectInstance } from './effect.js'
import { createIdentityInstance } from './identity.js'
import { scheduleNoteEvents } from './parts.js'
import { createSampleInstance } from './sample.js'
import type { Instance } from './types.js'

export interface WebAudioGraph {
  /**
   * Resolves once all instances have finished their load attempts.
   * Rejects if any instance fails to load or the timeout is reached.
   */
  readonly loaded: Promise<void>

  readonly dispose: () => void
  readonly disposed: boolean
}

export function createWebAudioGraph (program: Program, graph: AudioGraph<Node>, transport: Transport, fetcher: AudioFetcher): WebAudioGraph {
  const instances = new Map<NodeId, Instance>()
  for (const node of graph.nodes.values()) {
    instances.set(node.id, createNodeInstance(node, transport, fetcher))
  }

  setupRoutings(graph, instances, transport)
  scheduleNoteEvents(program, graph, instances)

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

function createNodeInstance (node: Node, transport: Transport, fetcher: AudioFetcher): Instance {
  switch (node.type) {
    case 'identity':
      return createIdentityInstance(node, transport)

    case 'gain':
    case 'pan':
    case 'lowpass':
    case 'highpass':
    case 'delay':
    case 'reverb':
      return createEffectInstance(node, transport)

    case 'sample':
      return createSampleInstance(node, transport, fetcher)
  }
}

function setupRoutings (graph: AudioGraph<Node>, instances: Map<NodeId, Instance>, transport: Transport): void {
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
      from.output.connect(transport.output)
    }
  }
}
